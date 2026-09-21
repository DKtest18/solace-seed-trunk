import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';

/**
 * PUBLIC PREVIEWS — products that are genuinely submitted / in review AND whose
 * seller explicitly consented to a public preview.
 *
 * Reads a restricted SECURITY DEFINER function that returns an explicit
 * allowlist of public fields only. Private columns never reach the browser.
 * Previews can never be purchased: the server-side purchasability check still
 * requires approval plus a ready payout account.
 *
 * Fails soft: if the function is not deployed yet, the marketplace simply shows
 * no previews instead of breaking.
 */
export interface PublicPreview {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  pricing_model: string | null;
  product_type: string | null;
  category_id: string | null;
  tags: string[] | null;
  delivery_mode: string | null;
  setup_requirements: unknown;
  seller_id: string;
  seller_name: string | null;
  seller_username: string | null;
  seller_avatar_url: string | null;
  seller_linkedin_verified: boolean;
  demo_video_allowed: boolean;
  submitted_at: string | null;
  created_at: string | null;
}

export function usePublicPreviews() {
  return useQuery({
    queryKey: ['public-previews'],
    staleTime: 60_000,
    queryFn: async (): Promise<PublicPreview[]> => {
      const { data, error } = await db.rpc('dkai_public_previews');
      if (error) return [];
      return (data as PublicPreview[]) ?? [];
    },
  });
}

export function usePublicPreview(productId?: string) {
  return useQuery({
    queryKey: ['public-preview', productId],
    enabled: !!productId,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicPreview | null> => {
      const { data, error } = await db.rpc('dkai_public_preview', { p_product_id: productId });
      if (error) return null;
      const rows = (data as PublicPreview[]) ?? [];
      return rows[0] ?? null;
    },
  });
}

export interface PreviewMediaRow {
  id: string;
  storage_path: string;
  media_type: 'image' | 'video';
  mime_type: string;
  sort_order: number;
  is_cover: boolean;
}

export function usePublicPreviewMedia(productId?: string) {
  return useQuery({
    queryKey: ['public-preview-media', productId],
    enabled: !!productId,
    staleTime: 60_000,
    queryFn: async (): Promise<PreviewMediaRow[]> => {
      const { data, error } = await db.rpc('dkai_public_preview_media', { p_product_id: productId });
      if (error) return [];
      return (data as PreviewMediaRow[]) ?? [];
    },
  });
}
