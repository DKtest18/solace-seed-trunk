import { useCallback, useState } from 'react';
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
  const [loaded, setLoaded] = useState(false);

  /** Loads persisted rows for a product/draft. */
  const load = useCallback(async (productId: string) => {
    const { data, error } = await db
      .from('dkai_product_media')
      .select('id, storage_path, media_type, mime_type, size_bytes, sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });
    if (!error && data) {
      setMedia(
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
  }, []);

  const persistOrder = useCallback(async (next: ProductMediaItem[]) => {
    await Promise.all(
      next.map((m, i) =>
        m.id
          ? db.from('dkai_product_media').update({ sort_order: i, is_cover: i === 0 }).eq('id', m.id)
          : Promise.resolve(),
      ),
    );
  }, []);

  /**
   * Uploads a file and inserts its row.
   * `ensureProductId` may create the draft row on demand.
   */
  const addFile = useCallback(
    async (file: File, ensureProductId: () => Promise<string | null>) => {
      if (!userId) throw new Error('Sign in required to upload media');
      const productId = await ensureProductId();
      if (!productId) throw new Error('Could not create the product draft');

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
      setMedia((prev) => [...prev, placeholder]);

      try {
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        const sortOrder = await new Promise<number>((resolve) => {
          setMedia((prev) => {
            resolve(prev.findIndex((m) => m.storage_path === storagePath));
            return prev;
          });
        });

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
            is_cover: sortOrder === 0,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;

        setMedia((prev) =>
          prev.map((m) =>
            m.storage_path === storagePath
              ? { ...m, id: (row as any).id, uploading: false, url: mediaPublicUrl(storagePath) }
              : m,
          ),
        );

        // Keep the legacy cover column in sync so listing cards always show an image.
        if (!isVideo && sortOrder === 0) {
          await db
            .from('dkai_products')
            .update({ image_url: mediaPublicUrl(storagePath) })
            .eq('id', productId);
        }
        return storagePath;
      } catch (e: any) {
        setMedia((prev) =>
          prev.map((m) =>
            m.storage_path === storagePath
              ? { ...m, uploading: false, error: e?.message || 'Upload failed' }
              : m,
          ),
        );
        throw e;
      }
    },
    [userId],
  );

  const remove = useCallback(async (index: number) => {
    let target: ProductMediaItem | undefined;
    setMedia((prev) => {
      target = prev[index];
      return prev.filter((_, i) => i !== index);
    });
    if (!target) return;
    if (target.id) await db.from('dkai_product_media').delete().eq('id', target.id);
    const [bucket, ...rest] = target.storage_path.split('/');
    await supabase.storage.from(bucket).remove([rest.join('/')]);
  }, []);

  const reorder = useCallback(
    async (next: ProductMediaItem[]) => {
      setMedia(next);
      await persistOrder(next);
    },
    [persistOrder],
  );

  return { media, setMedia, loaded, load, addFile, remove, reorder };
}
