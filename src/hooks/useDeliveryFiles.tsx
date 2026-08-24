import { useCallback, useRef, useState } from 'react';

import { db } from '@/lib/dkaiDb';
import { uploadDeliveryFile, deleteDeliveryFile } from '@/lib/deliveryFileUpload';

export interface DeliveryFileRow {
  id: string;
  original_filename: string;
  file_size: number;
  storage_path: string | null;
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
 * Uploads go directly to the private `product-deliveries` bucket under the owner's
 * uid prefix, then persist in dkai_product_files. Delivery uploads never update
 * the product row or its review status. Every failure surfaces its real text.
 */
export function useDeliveryFiles(ensureDraftId: () => Promise<string | null>) {
  const [files, setFiles] = useState<DeliveryFileRow[]>([]);
  const filesRef = useRef<DeliveryFileRow[]>([]);
  const currentProductRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const apply = useCallback((next: DeliveryFileRow[]) => {
    filesRef.current = next;
    setFiles(next);
  }, []);

  const load = useCallback(
    async (productId: string) => {
      currentProductRef.current = productId;
      const { data, error } = await db
        .from('dkai_product_files')
        .select('id, original_filename, file_size, storage_path, scan_status')
        .eq('product_id', productId)
        .order('uploaded_at', { ascending: true });
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
        { id: tempId, original_filename: file.name, file_size: file.size, storage_path: null, scan_status: 'pending', uploading: true, error: null },
      ]);
      setUploading(true);
      try {
        const productId = await ensureDraftId();
        if (!productId) throw new Error('Could not create the product draft, so the file could not be attached.');

        const inserted = await uploadDeliveryFile(productId, file);
        currentProductRef.current = productId;

        const row: DeliveryFileRow = {
          id: inserted.id,
          original_filename: inserted.original_filename,
          file_size: inserted.file_size,
          storage_path: inserted.storage_path,
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
      const row = filesRef.current.find((f) => f.id === id);
      const productId = currentProductRef.current ?? (await ensureDraftId());
      if (!productId) throw new Error('Product draft is missing, so the file could not be deleted.');
      void row;
      await deleteDeliveryFile(productId, id);
      apply(filesRef.current.filter((f) => f.id !== id));
    },
    [apply, ensureDraftId],
  );

  return { files, filesRef, uploading, load, addFile, remove };
}
