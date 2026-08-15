import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import type { ProductMediaItem } from '@/components/product-creation/ImagesStep';

export const IMAGE_BUCKET = 'product-images';
export const VIDEO_BUCKET = 'product-media';

export function mediaPublicUrl(storagePath: string) {
  const [bucket, ...rest] = storagePath.split('/');
  return supabase.storage.from(bucket).getPublicUrl(rest.join('/')).data.publicUrl;
}

/**
 * Persists product gallery media (images + videos) to storage and
 * `dkai_product_media` IMMEDIATELY when the seller picks a file, instead of only
 * at final submit. That is what makes media survive leaving the wizard, resuming
 * a draft, or editing an existing product.
 */
export function useProductMedia(userId?: string) {
  const [media, setMedia] = useState<ProductMediaItem[]>([]);
  const mediaRef = useRef<ProductMediaItem[]>([]);
  const productIdRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const replaceMedia = useCallback((next: ProductMediaItem[]) => {
    mediaRef.current = next;
    setMedia(next);
  }, []);

  const syncCover = useCallback(async (next: ProductMediaItem[]) => {
    const productId = productIdRef.current;
    if (!productId) return;
    const cover = next.find((item) => item.media_type === 'image' && !item.uploading && !item.error);
    await db
      .from('dkai_products')
      .update({ image_url: cover?.url || null })
      .eq('id', productId);
  }, []);

  /** Loads persisted rows for a product/draft. */
  const load = useCallback(async (productId: string) => {
    productIdRef.current = productId;
    const { data, error } = await db
      .from('dkai_product_media')
      .select('id, storage_path, media_type, mime_type, size_bytes, sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });
    if (!error && data) {
      replaceMedia(
        (data as any[]).map((r) => ({
          id: r.id,
          storage_path: r.storage_path,
          media_type: r.media_type,
          mime_type: r.mime_type ?? '',
          size_bytes: r.size_bytes ?? 0,
          url: mediaPublicUrl(r.storage_path),
        })),
      );
    }
    setLoaded(true);
  }, [replaceMedia]);

  const persistOrder = useCallback(async (next: ProductMediaItem[]) => {
    const firstImageId = next.find((item) => item.media_type === 'image')?.id;
    await Promise.all(
      next.map((m, i) =>
        m.id
          ? db.from('dkai_product_media').update({ sort_order: i, is_cover: m.id === firstImageId }).eq('id', m.id)
          : Promise.resolve(),
      ),
    );
    await syncCover(next);
  }, [syncCover]);

  /**
   * Uploads a file and inserts its row.
   * `ensureProductId` may create the draft row on demand.
   */
  const addFile = useCallback(
    async (file: File, ensureProductId: () => Promise<string | null>) => {
      if (!userId) throw new Error('Sign in required to upload media');
      const productId = await ensureProductId();
      if (!productId) throw new Error('Could not create the product draft');
      productIdRef.current = productId;

      const isVideo = file.type.startsWith('video/');
      const bucket = isVideo ? VIDEO_BUCKET : IMAGE_BUCKET;
      const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const storagePath = `${bucket}/${path}`;

      const placeholder: ProductMediaItem = {
        storage_path: storagePath,
        media_type: isVideo ? 'video' : 'image',
        mime_type: file.type,
        size_bytes: file.size,
        url: '',
        uploading: true,
      };
      replaceMedia([...mediaRef.current, placeholder]);

      try {
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        const sortOrder = mediaRef.current.findIndex((m) => m.storage_path === storagePath);
        const hasEarlierImage = mediaRef.current.some(
          (item, index) => index < sortOrder && item.media_type === 'image' && !item.error,
        );

        const { data: row, error: insErr } = await db
          .from('dkai_product_media')
          .insert({
            product_id: productId,
            seller_id: userId,
            storage_path: storagePath,
            media_type: isVideo ? 'video' : 'image',
            mime_type: file.type,
            size_bytes: file.size,
            sort_order: Math.max(0, sortOrder),
            is_cover: !isVideo && !hasEarlierImage,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;

        const next = mediaRef.current.map((m) =>
            m.storage_path === storagePath
              ? { ...m, id: (row as any).id, uploading: false, url: mediaPublicUrl(storagePath) }
              : m,
        );
        replaceMedia(next);

        // Keep the legacy cover column in sync so listing cards always show an image.
        await syncCover(next);
        return storagePath;
      } catch (e: any) {
        const failed = mediaRef.current.map((m) =>
            m.storage_path === storagePath
              ? { ...m, uploading: false, error: e?.message || 'Upload failed' }
              : m,
        );
        replaceMedia(failed);
        throw e;
      }
    },
    [replaceMedia, syncCover, userId],
  );

  const remove = useCallback(async (index: number) => {
    const target = mediaRef.current[index];
    if (!target) return;
    const next = mediaRef.current.filter((_, i) => i !== index);
    replaceMedia(next);
    if (target.id) await db.from('dkai_product_media').delete().eq('id', target.id);
    const [bucket, ...rest] = target.storage_path.split('/');
    await supabase.storage.from(bucket).remove([rest.join('/')]);
    await persistOrder(next);
  }, [persistOrder, replaceMedia]);

  const reorder = useCallback(
    async (next: ProductMediaItem[]) => {
      replaceMedia(next);
      await persistOrder(next);
    },
    [persistOrder, replaceMedia],
  );

  return { media, setMedia, loaded, load, addFile, remove, reorder };
}
