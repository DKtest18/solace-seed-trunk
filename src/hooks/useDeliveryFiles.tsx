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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(((reader.result as string) || '').split(',')[1] ?? '');
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Server-persisted delivery files for the product wizard.
 *
 * Root cause this replaces: the wizard used to keep raw File objects in local
 * React state and never uploaded them, so file_storage_key / file_size_bytes /
 * file_scan_status stayed NULL on the product row and admins saw nothing.
 *
 * Uploads go through the `upload-product-file` edge function (private
 * `product-files` bucket, ownership-checked, row inserted in
 * dkai_product_files). Every failure is surfaced with its real message.
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

        const base64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke('upload-product-file', {
          body: {
            product_id: productId,
            file_name: file.name,
            mime_type: file.type || 'application/octet-stream',
            file_size: file.size,
            base64_content: base64,
          },
        });
        const returnedError = (data as any)?.error;
        if (error || returnedError) throw new Error(returnedError || error?.message || 'Upload failed');

        const row: DeliveryFileRow = {
          id: (data as any).file_id,
          file_name: file.name,
          file_size: file.size,
          file_path: (data as any).file_path ?? null,
          scan_status: (data as any).scan_status ?? 'clean',
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
