import { supabase } from '@/integrations/supabase/client';

export interface DeliveryFileRecord {
  id: string;
  file_name: string;
  file_size: number;
  file_path: string;
  mime_type?: string;
  scan_status: string;
  created_at?: string;
}

const BUCKET = 'product-files';

export function sanitizeDeliveryFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 120);
}

function isTransportError(error: any) {
  const msg = String(error?.message ?? error ?? '');
  return (
    /Failed to send a request/i.test(msg) ||
    /Failed to fetch/i.test(msg) ||
    /NetworkError/i.test(msg) ||
    /not found/i.test(msg) ||
    /404/.test(msg)
  );
}

/**
 * Uploads a delivery file for a product and persists it server-side.
 *
 * Primary path: `product-delivery-files` edge function — it issues a signed
 * upload URL for the PRIVATE bucket and commits the row with the service role,
 * which also works after the product was submitted for review or approved.
 *
 * Fallback path (function not deployed / unreachable): direct storage upload +
 * client-side inserts under RLS. Real error text is always surfaced.
 */
export async function uploadDeliveryFile(
  productId: string,
  file: File,
): Promise<DeliveryFileRecord> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error('Your session expired. Please sign in again before uploading.');

  const mimeType = file.type || 'application/octet-stream';

  try {
    const { data: signData, error: signError } = await supabase.functions.invoke(
      'product-delivery-files',
      {
        body: {
          action: 'sign_upload',
          product_id: productId,
          file_name: file.name,
          file_size: file.size,
          mime_type: mimeType,
        },
      },
    );
    if (signError) throw signError;
    if ((signData as any)?.error) throw new Error((signData as any).error);

    const { path, token, file_id } = signData as any;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(path, token, file, { contentType: mimeType });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: commitData, error: commitError } = await supabase.functions.invoke(
      'product-delivery-files',
      {
        body: {
          action: 'commit',
          product_id: productId,
          file_id,
          path,
          file_name: file.name,
          file_size: file.size,
          mime_type: mimeType,
        },
      },
    );
    if (commitError) throw commitError;
    if ((commitData as any)?.error) throw new Error((commitData as any).error);
    return (commitData as any).file as DeliveryFileRecord;
  } catch (err: any) {
    if (!isTransportError(err)) throw new Error(err?.message || String(err));
    // ---- fallback: direct upload under RLS ----
    const fileId = crypto.randomUUID();
    const filePath = `${userId}/${productId}/${fileId}-${sanitizeDeliveryFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { contentType: mimeType, upsert: false });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: inserted, error: insertError } = await (supabase as any)
      .from('dkai_product_files')
      .insert({
        id: fileId,
        product_id: productId,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: mimeType,
        scan_status: 'clean',
        uploaded_by: userId,
      })
      .select('id, file_name, file_size, file_path, mime_type, scan_status, created_at')
      .single();
    if (insertError || !inserted) {
      await supabase.storage.from(BUCKET).remove([filePath]);
      throw new Error(`File record save failed: ${insertError?.message || 'No row returned'}`);
    }

    const { data: updatedProduct, error: productError } = await (supabase as any)
      .from('dkai_products')
      .update({ file_storage_key: filePath, file_size_bytes: file.size, file_scan_status: 'clean' })
      .eq('id', productId)
      .select('id')
      .single();
    if (productError || !updatedProduct) {
      await (supabase as any).from('dkai_product_files').delete().eq('id', fileId);
      await supabase.storage.from(BUCKET).remove([filePath]);
      throw new Error(
        `Product file metadata save failed: ${productError?.message || 'The product row was not updated'}`,
      );
    }

    return inserted as DeliveryFileRecord;
  }
}

/** Deletes a delivery file (server-side when possible, else under RLS). */
export async function deleteDeliveryFile(productId: string, fileId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('product-delivery-files', {
      body: { action: 'delete', product_id: productId, file_id: fileId },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return;
  } catch (err: any) {
    if (!isTransportError(err)) throw new Error(err?.message || String(err));
    const { error } = await (supabase as any).from('dkai_product_files').delete().eq('id', fileId);
    if (error) throw new Error(error.message);
  }
}

/** Sends a product (back) to review after delivery files changed. */
export async function resubmitProductForReview(productId: string) {
  const { data, error } = await supabase.functions.invoke('product-delivery-files', {
    body: { action: 'resubmit', product_id: productId },
  });
  if (!error && !(data as any)?.error) return;

  if (error && !isTransportError(error)) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);

  const { data: fallback, error: fallbackError } = await supabase.functions.invoke(
    'submit-product-for-review',
    { body: { product_id: productId } },
  );
  if (fallbackError) throw new Error(fallbackError.message);
  if ((fallback as any)?.error) throw new Error((fallback as any).error);
}
