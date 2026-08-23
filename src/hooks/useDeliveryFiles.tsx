import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';

export interface DeliveryFileRow {
  id: string;
  file_name: string;
  file_size: number;
  file_path: string | null;
  scan_status: string;
  uploading?: boolean;
  error?: string | null;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 120);
}

/**
 * Server-persisted delivery files for the product wizard.
 *
 * Root cause this replaces: the wizard used to keep raw File objects in local
 * React state and never uploaded them, so file_storage_key / file_size_bytes /
 * file_scan_status stayed NULL on the product row and admins saw nothing.
 *
 * Uploads go directly to the private `product-files` bucket under the owner's
 * uid prefix, then persist in dkai_product_files and the product's primary-file
 * columns. Every storage or database failure is surfaced with its real text.
 */
export function useDeliveryFiles(ensureDraftId: () => Promise<string | null>) {
  const [files, setFiles] = useState<DeliveryFileRow[]>([]);
  const filesRef = useRef<DeliveryFileRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const apply = useCallback((next: DeliveryFileRow[]) => {
    filesRef.current = next;
    setFiles(next);
  }, []);

  const load = useCallback(
    async (productId: string) => {
      const { data, error } = await db
        .from('dkai_product_files')
        .select('id, file_name, file_size, file_path, scan_status')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      apply(((data as DeliveryFileRow[]) ?? []).map((r) => ({ ...r, uploading: false, error: null })));
    },
    [apply],
  );

  /** Uploads one file. Throws with the real error text on failure. */
  const addFile = useCallback(
    async (file: File) => {
      const tempId = `temp-${crypto.randomUUID()}`;
      apply([
        ...filesRef.current,
        { id: tempId, file_name: file.name, file_size: file.size, file_path: null, scan_status: 'pending', uploading: true, error: null },
      ]);
      setUploading(true);
      try {
        const productId = await ensureDraftId();
        if (!productId) throw new Error('Could not create the product draft, so the file could not be attached.');

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const ownerId = authData.user?.id;
        if (!ownerId) throw new Error('Your session expired. Please sign in again before uploading.');

        const fileId = crypto.randomUUID();
        const filePath = `${ownerId}/${productId}/${fileId}-${sanitizeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from('product-files')
          .upload(filePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });
        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

        const { data: inserted, error: insertError } = await db
          .from('dkai_product_files')
          .insert({
            id: fileId,
            product_id: productId,
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
            scan_status: 'clean',
            uploaded_by: ownerId,
          })
          .select('id, file_name, file_size, file_path, scan_status')
          .single();
        if (insertError || !inserted) {
          await supabase.storage.from('product-files').remove([filePath]);
          throw new Error(`File record save failed: ${insertError?.message || 'No row returned'}`);
        }

        const { data: updatedProduct, error: productError } = await db
          .from('dkai_products')
          .update({
            file_storage_key: filePath,
            file_size_bytes: file.size,
            file_scan_status: 'clean',
          })
          .eq('id', productId)
          .select('id')
          .single();
        if (productError || !updatedProduct) {
          await db.from('dkai_product_files').delete().eq('id', fileId);
          await supabase.storage.from('product-files').remove([filePath]);
          throw new Error(`Product file metadata save failed: ${productError?.message || 'The product row was not updated'}`);
        }

        const row: DeliveryFileRow = {
          id: inserted.id,
          file_name: inserted.file_name,
          file_size: inserted.file_size,
          file_path: inserted.file_path,
          scan_status: inserted.scan_status,
          uploading: false,
          error: null,
        };
        apply(filesRef.current.map((f) => (f.id === tempId ? row : f)));
        return row;
      } catch (err: any) {
        const message = err?.message || String(err);
        apply(
          filesRef.current.map((f) =>
            f.id === tempId ? { ...f, uploading: false, scan_status: 'failed', error: message } : f,
          ),
        );
        throw new Error(message);
      } finally {
        setUploading(false);
      }
    },
    [apply, ensureDraftId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (id.startsWith('temp-')) {
        apply(filesRef.current.filter((f) => f.id !== id));
        return;
      }
      const { error } = await db.from('dkai_product_files').delete().eq('id', id);
      if (error) throw error;
      apply(filesRef.current.filter((f) => f.id !== id));
    },
    [apply],
  );

  return { files, filesRef, uploading, load, addFile, remove };
}
