import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

import { AppLayout } from '@/components/AppLayout';
import { CommunityRulesGuard } from '@/components/community/CommunityRulesGuard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2, MessageCircle, Paperclip, MessageSquare, Share2, Pin, Eye,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CreatePostDialog } from '@/components/community/CreatePostDialog';
import { useToast } from '@/hooks/use-toast';

interface CommunityPost {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  pinned: boolean;
  views_count: number;
  comments_count: number;
  has_attachment: boolean;
  attachment_file_name: string | null;
  author: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  product: {
    id: string;
    title: string;
    price: number;
    image_url: string | null;
  } | null;
  seller_id: string | null;
  can_message_seller: boolean;
}

type FilterKey = 'all' | 'pinned' | 'attachments';

export default function Community() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [memberCount, setMemberCount] = useState<number | null>(null);

  const PAGE_SIZE = 20;

  useEffect(() => { fetchPosts(); /* eslint-disable-next-line */ }, [page, user?.id]);
  useEffect(() => { fetchMemberCount(); }, []);

  const fetchMemberCount = async () => {
    try {
      const { count } = await db.from('dkai_profiles').select('id', { count: 'exact', head: true });
      if (typeof count === 'number') setMemberCount(count);
    } catch {
      // silent — sidebar will fall back to "Growing daily"
    }
  };

  const fetchPostsDirect = async () => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: rawPosts, error: postsError } = await db
      .from('dkai_community_posts')
      .select('id, title, body, created_at, views_count, comments_count, attachment_file_name, attachment_key, author_id, product_id, seller_id, is_public')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (postsError) throw postsError;

    const authorIds = Array.from(new Set((rawPosts ?? []).map((post: any) => post.author_id).filter(Boolean)));
    const productIds = Array.from(new Set((rawPosts ?? []).map((post: any) => post.product_id).filter(Boolean)));

    const [profilesRes, productsRes] = await Promise.all([
      authorIds.length
        ? db.from('dkai_profiles').select('id, username, full_name, avatar_url').in('id', authorIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? db.from('dkai_products').select('id, title, price, image_url').in('id', productIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profilesById = new Map((profilesRes.data ?? []).map((profile: any) => [profile.id, profile]));
    const productsById = new Map((productsRes.data ?? []).map((product: any) => [product.id, product]));

    const normalizedPosts: CommunityPost[] = (rawPosts ?? []).map((post: any) => {
      const resolvedSellerId = post.seller_id ?? post.author_id ?? null;
      return {
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
        seller_id: resolvedSellerId,
        can_message_seller: !!resolvedSellerId && resolvedSellerId !== user?.id,
      };
    });

    return { posts: normalizedPosts, hasMore: (rawPosts?.length ?? 0) === PAGE_SIZE };
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-community-posts', {
        body: { page, limit: PAGE_SIZE }
      });

      if (error) throw error;
      if (!data || !Array.isArray(data.posts)) {
        throw new Error('Invalid response from get-community-posts');
      }

      setPosts(prev => page === 1 ? data.posts : [...prev, ...data.posts]);
      setHasMore(Boolean(data.has_more));
    } catch (primaryError) {
      console.warn('Edge function get-community-posts failed, using direct DB fallback:', primaryError);
      try {
        const fallbackData = await fetchPostsDirect();
        setPosts(prev => page === 1 ? fallbackData.posts : [...prev, ...fallbackData.posts]);
        setHasMore(fallbackData.hasMore);
      } catch (fallbackError) {
        console.error('Error fetching community posts:', fallbackError);
        toast({ title: 'Error', description: 'Failed to load community posts', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = () => {
    setCreateDialogOpen(false);
    setPage(1);
    fetchPosts();
  };

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/community/${postId}`;
    if (navigator.share) {
      navigator.share({ url }).catch(() => {/* user cancelled */});
    } else {
      navigator.clipboard?.writeText(url).then(
        () => toast({ title: 'Link copied', description: 'Post URL copied to clipboard.' }),
        () => toast({ title: 'Copy failed', variant: 'destructive' }),
      );
    }
  };

  const filteredPosts = useMemo(() => {
    if (activeFilter === 'pinned') return posts.filter(p => p.pinned);
    if (activeFilter === 'attachments') return posts.filter(p => p.has_attachment);
    return posts;
  }, [posts, activeFilter]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pinned', label: 'Pinned' },
    { key: 'attachments', label: 'With attachments' },
  ];

  return (
    <AppLayout>
      <CommunityRulesGuard>
        <div className="min-h-screen bg-background">
          <header className="max-w-5xl mx-auto px-6 pt-12 pb-6">
            <h1 className="text-4xl font-display font-semibold text-gray-900 mb-2">Community</h1>
            <p className="text-muted">
              Ask questions, share builds, discuss AI tooling with other DK AI Marketplace members.
            </p>
          </header>

          <div className="max-w-5xl mx-auto px-6 pb-16 grid lg:grid-cols-[1fr_280px] gap-8">
            {/* Main column */}
            <div className="min-w-0">
              {/* Create post entry */}
              {user && (
                <Card className="p-4 flex items-center gap-3 mb-6 rounded-xl">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback>
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => setCreateDialogOpen(true)}
                    className="flex-1 text-left text-muted bg-background-soft rounded-full px-4 py-2.5 hover:bg-gray-100 transition-colors text-sm"
                  >
                    Share something with the community...
                  </button>
                </Card>
              )}

              {/* Category / filter tabs */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                {filters.map((f) => {
                  const active = activeFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
                        active
                          ? 'bg-gray-900 text-white'
                          : 'bg-background-soft text-muted hover:bg-gray-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Post list */}
              {loading && page === 1 ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-20">
                  <MessageSquare className="mx-auto mb-4 text-muted" size={48} />
                  <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">
                    {activeFilter === 'all' ? 'No posts yet' : 'Nothing in this category yet.'}
                  </h2>
                  {activeFilter === 'all' && (
                    <p className="text-muted">Be the first to start a discussion.</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredPosts.map((post) => (
                    <Link
                      to={`/community/${post.id}`}
                      key={post.id}
                      className="block"
                    >
                      <Card className="p-5 hover:shadow-card-hover transition-all cursor-pointer rounded-xl">
                        {/* Top meta row */}
                        <div className="flex items-center gap-2 mb-3">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={post.author?.avatar_url || undefined} />
                            <AvatarFallback>
                              {post.author?.full_name?.[0] || post.author?.username?.[0] || 'A'}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="text-sm font-medium text-gray-900 hover:underline"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/profile/${post.author?.id}`; }}
                          >
                            {post.author?.full_name || post.author?.username || 'Anonymous'}
                          </span>
                          <span className="text-muted text-sm">·</span>
                          <span className="text-sm text-muted">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                          {post.pinned && (
                            <span className="ml-auto inline-flex items-center gap-1 bg-primary-soft text-primary text-xs px-2.5 py-0.5 rounded-full">
                              <Pin className="h-3 w-3" /> Pinned
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        {post.title && (
                          <h2 className="font-display text-lg font-semibold text-gray-900 mb-2">
                            {post.title}
                          </h2>
                        )}

                        {/* Body excerpt */}
                        <p className="text-gray-700 line-clamp-3 mb-4 whitespace-pre-wrap">
                          {post.body}
                        </p>

                        {/* Linked product */}
                        {post.product && (
                          <div
                            className="mb-4 flex items-center gap-3 p-3 rounded-lg border border-border bg-background-soft hover:bg-gray-100 transition-colors"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/product/${post.product!.id}`; }}
                          >
                            {post.product.image_url && (
                              <img
                                src={post.product.image_url}
                                alt={post.product.title}
                                className="w-14 h-14 object-cover rounded-md"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{post.product.title}</p>
                              <span className="inline-flex bg-primary-soft text-primary text-xs px-2 py-0.5 rounded-full mt-1">
                                ${post.product.price}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Attachment indicator */}
                        {post.has_attachment && (
                          <div className="flex items-center gap-1 text-sm text-muted mb-4">
                            <Paperclip className="h-4 w-4" />
                            <span className="truncate">{post.attachment_file_name || 'Attachment'}</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-5 text-muted text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Eye className="h-4 w-4" />
                            {post.views_count}
                          </span>
                          <span className="inline-flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                            <MessageCircle className="h-4 w-4" />
                            {post.comments_count}
                          </span>
                          <button
                            className="inline-flex items-center gap-1.5 hover:text-gray-900 transition-colors ml-auto"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShare(post.id); }}
                            aria-label="Share post"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                      </Card>
                    </Link>
                  ))}

                  {hasMore && (
                    <div className="flex justify-center mt-2">
                      <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 flex flex-col gap-4">
                <Card className="p-5 rounded-xl">
                  <h3 className="font-display font-semibold text-gray-900 mb-3">About community</h3>
                  <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                    A focused space for AI builders, founders, and curious learners to share what
                    they're working on and help each other ship better.
                  </p>
                  <div className="flex items-center justify-between text-sm border-t border-border pt-3 mb-3">
                    <span className="text-muted">Members</span>
                    <span className="font-medium text-gray-900">
                      {memberCount !== null ? memberCount.toLocaleString() : 'Growing daily'}
                    </span>
                  </div>
                  <Link
                    to="/legal/community-guidelines"
                    className="text-sm text-primary hover:underline"
                  >
                    Community guidelines →
                  </Link>
                </Card>
              </div>
            </aside>
          </div>
        </div>

        <CreatePostDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onPostCreated={handlePostCreated}
        />
      </CommunityRulesGuard>
    </AppLayout>
  );
}
