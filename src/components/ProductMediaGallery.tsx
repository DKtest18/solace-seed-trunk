import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  productId: string;
  fallbackImageUrl?: string | null;
}

interface MediaRow {
  id: string;
  storage_path: string; // "bucket/path"
  media_type: 'image' | 'video';
  mime_type: string;
  sort_order: number;
  is_cover: boolean;
}

function publicUrl(storagePath: string) {
  const [bucket, ...rest] = storagePath.split('/');
  const path = rest.join('/');
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function ProductMediaGallery({ productId, fallbackImageUrl }: Props) {
  const { data: media = [] } = useQuery({
    queryKey: ['product-media', productId],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_product_media')
        .select('id, storage_path, media_type, mime_type, sort_order, is_cover')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      if (error) return [];
      return (data as MediaRow[]) ?? [];
    },
  });

  const [activeIdx, setActiveIdx] = useState(0);

  if (media.length === 0) {
    return fallbackImageUrl ? (
      <div className="aspect-video bg-muted overflow-hidden rounded-lg">
        <img src={fallbackImageUrl} alt="Product" className="w-full h-full object-cover" />
      </div>
    ) : (
      <div className="aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        No media available
      </div>
    );
  }

  const active = media[activeIdx] ?? media[0];
  const activeUrl = publicUrl(active.storage_path);

  return (
    <div className="space-y-3">
      <div className="aspect-video bg-muted overflow-hidden rounded-lg flex items-center justify-center">
        {active.media_type === 'video' ? (
          <video src={activeUrl} controls className="w-full h-full object-contain bg-black" />
        ) : (
          <img src={activeUrl} alt="Product media" className="w-full h-full object-cover" />
        )}
      </div>
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {media.map((m, i) => {
            const url = publicUrl(m.storage_path);
            return (
              <button
                key={m.id}
                onClick={() => setActiveIdx(i)}
                className={`shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 ${
                  i === activeIdx ? 'border-primary' : 'border-transparent'
                }`}
                aria-label={`Media ${i + 1}`}
              >
                {m.media_type === 'video' ? (
                  <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">▶ Video</div>
                ) : (
                  <img src={url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
