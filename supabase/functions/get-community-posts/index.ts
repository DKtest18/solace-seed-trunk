import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  // Allow both GET and POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    let page = 1;
    let limit = 20;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        page = body.page ?? 1;
        limit = Math.min(body.limit ?? 20, 100);
      } catch {
        // use defaults
      }
    }

    const admin = getServiceClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: rawPosts, error: postsError } = await admin
      .from('dkai_community_posts')
      .select('id, title, body, created_at, views_count, comments_count, attachment_file_name, attachment_key, author_id, product_id, seller_id, is_public')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (postsError) throw postsError;

    const authorIds = [...new Set((rawPosts ?? []).map((p: any) => p.author_id).filter(Boolean))];
    const productIds = [...new Set((rawPosts ?? []).map((p: any) => p.product_id).filter(Boolean))];

    const [profilesRes, productsRes] = await Promise.all([
      authorIds.length
        ? admin.from('dkai_profiles').select('id, username, full_name, avatar_url').in('id', authorIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? admin.from('dkai_products').select('id, title, price, image_url').in('id', productIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profilesById = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const productsById = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));

    const posts = (rawPosts ?? []).map((post: any) => ({
      id: post.id,
      title: post.title ?? null,
      body: post.body,
      created_at: post.created_at,
      pinned: false,
      views_count: post.views_count ?? 0,
      comments_count: post.comments_count ?? 0,
      has_attachment: !!(post.attachment_file_name || post.attachment_key),
      attachment_file_name: post.attachment_file_name ?? null,
      author: profilesById.get(post.author_id) ?? null,
      product: post.product_id ? (productsById.get(post.product_id) ?? null) : null,
      seller_id: post.seller_id ?? post.author_id ?? null,
      can_message_seller: false,
    }));

    return jsonResponse({ posts, has_more: (rawPosts?.length ?? 0) === limit });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
