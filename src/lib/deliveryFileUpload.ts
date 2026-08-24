import { supabase } from '@/integrations/supabase/client';
import * as tus from 'tus-js-client';

export interface DeliveryFileRecord {
  id: string;
  original_filename: string;
  file_size: number;
  storage_path: string;
  mime_type?: string;
  scan_status: string;
  uploaded_at?: string;
}

const BUCKET = 'product-deliveries';
export const MAX_DELIVERY_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const SUPABASE_URL = 'https://dwqpkdatzdqhplgyhigg.supabase.co';

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

async function uploadResumable(path: string, file: File, token: string) {
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: BUCKET,
        objectName: path,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onError: (error) => reject(error instanceof Error ? error : new Error(String(error))),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(() => upload.start());
  });
}

/**
 * Uploads a delivery file for a product and persists it server-side.
 *
  * Primary path: `product-delivery-files` reserves a private uid-prefixed path,
  * the browser uploads it resumably, and the function commits the database row,
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
  if (file.size > MAX_DELIVERY_FILE_SIZE) {
    throw new Error(
      `This file is too large to upload directly. The limit is ${formatBytes(MAX_DELIVERY_FILE_SIZE)} and the file is ${formatBytes(file.size)}. Please email support@dkaimarketplace.com and we will help you deliver it. We reply within 24 to 48 hours.`,
    );
  }

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

    const { path, file_id } = signData as any;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Your session expired. Please sign in again before uploading.');
    await uploadResumable(path, file, accessToken);

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
    const filePath = `${userId}/${sanitizeDeliveryFileName(file.name)}`;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Your session expired. Please sign in again before uploading.');
    await uploadResumable(filePath, file, accessToken);

    const { data: inserted, error: insertError } = await (supabase as any)
      .from('dkai_product_files')
      .insert({
        id: fileId,
        product_id: productId,
        seller_id: userId,
        storage_bucket: BUCKET,
        storage_path: filePath,
        original_filename: file.name,
        file_size: file.size,
        mime_type: mimeType,
        scan_status: 'clean',
      })
      .select('id, original_filename, file_size, storage_path, mime_type, scan_status, uploaded_at')
      .single();
    if (insertError || !inserted) {
      await supabase.storage.from(BUCKET).remove([filePath]);
      throw new Error(`File record save failed: ${insertError?.message || 'No row returned'}`);
    }

    return inserted as DeliveryFileRecord;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
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
