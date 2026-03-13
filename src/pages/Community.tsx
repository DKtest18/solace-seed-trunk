import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

import { AppLayout } from '@/components/AppLayout';
import { CommunityRulesGuard } from '@/components/community/CommunityRulesGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, Eye, Pin, Paperclip, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ClickableAvatar } from '@/components/ClickableAvatar';
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

export default function Community() {
  const { user } = useAuth();
  
  const { toast } = useToast();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleCreatePost = () => {
    setCreateDialogOpen(true);
  };

  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchPosts();
  }, [page, user?.id]);

  const fetchPostsDirect = async () => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: rawPosts, error: postsError } = await db
      .from('dkai_community_posts')
      .select('id, title, body, created_at, pinned, views_count, comments_count, attachment_file_name, attachment_key, author_id, product_id, seller_id, is_public')
      .eq('is_public', true)
      .order('pinned', { ascending: false })
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

    if (profilesRes.error) {
      console.warn('Community profiles fallback query failed:', profilesRes.error);
    }

    if (productsRes.error) {
      console.warn('Community products fallback query failed:', productsRes.error);
    }

    const profilesById = new Map((profilesRes.data ?? []).map((profile: any) => [profile.id, profile]));
    const productsById = new Map((productsRes.data ?? []).map((product: any) => [product.id, product]));

    const normalizedPosts: CommunityPost[] = (rawPosts ?? []).map((post: any) => {
      const resolvedSellerId = post.seller_id ?? post.author_id ?? null;

      return {
        id: post.id,
        title: post.title ?? null,
        body: post.body,
        created_at: post.created_at,
        pinned: !!post.pinned,
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

    return {
      posts: normalizedPosts,
      hasMore: (rawPosts?.length ?? 0) === PAGE_SIZE,
    };
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
        toast({
          title: 'Error',
          description: 'Failed to load community posts',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContactSeller = async (sellerId: string, productId: string | null) => {
    if (!user) {
      toast({
        title: 'Please log in',
        description: 'You must be logged in to message sellers',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-message-thread', {
        body: {
          recipient_id: sellerId,
          product_id: productId || undefined,
        }
      });

      if (error) throw error;

      window.location.href = `/messages?thread=${data.thread_id}`;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast({
        title: 'Error',
        description: 'Failed to start conversation',
        variant: 'destructive',
      });
    }
  };

  const handlePostCreated = () => {
    setCreateDialogOpen(false);
    setPage(1);
    fetchPosts();
  };

  return (
    <AppLayout>
      <CommunityRulesGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Community</h1>
              <p className="text-muted-foreground">Share insights and connect with sellers</p>
            </div>
            {user && (
              <Button onClick={handleCreatePost}>
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            )}
          </div>

          {/* Posts Feed */}
          <div className="space-y-6">
            {loading && page === 1 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : posts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {posts.map((post) => (
                  <Card key={post.id} className={post.pinned ? 'border-primary' : ''}>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        {post.author && (
                          <ClickableAvatar
                            userId={post.author.id}
                            avatarUrl={post.author.avatar_url}
                            username={post.author.username || post.author.full_name}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              to={`/profile/${post.author?.id}`}
                              className="font-semibold hover:underline"
                            >
                              {post.author?.full_name || post.author?.username || 'Anonymous'}
                            </Link>
                            <span className="text-sm text-muted-foreground">
                              • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </span>
                            {post.pinned && (
                              <Badge variant="secondary">
                                <Pin className="h-3 w-3 mr-1" />
                                Pinned
                              </Badge>
                            )}
                          </div>
                          {post.title && (
                            <CardTitle className="mb-2">
                              <Link to={`/community/${post.id}`} className="hover:text-primary">
                                {post.title}
                              </Link>
                            </CardTitle>
                          )}
                          <p className="text-foreground whitespace-pre-wrap mb-4">{post.body}</p>

                          {/* Product Card */}
                          {post.product && (
                            <Link to={`/product/${post.product.id}`}>
                              <Card className="mb-4 hover:shadow-lg transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                  {post.product.image_url && (
                                    <img
                                      src={post.product.image_url}
                                      alt={post.product.title}
                                      className="w-16 h-16 object-cover rounded"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{post.product.title}</h4>
                                    <Badge variant="secondary">${post.product.price}</Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          )}

                          {/* Footer */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {post.views_count}
                            </span>
                            <Link
                              to={`/community/${post.id}`}
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              <MessageCircle className="h-4 w-4" />
                              {post.comments_count}
                            </Link>
                            {post.has_attachment && (
                              <span className="flex items-center gap-1">
                                <Paperclip className="h-4 w-4" />
                                {post.attachment_file_name}
                              </span>
                            )}
                            {post.can_message_seller && post.seller_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleContactSeller(post.seller_id!, post.product?.id || null)}
                              >
                                <MessageCircle className="h-3 w-3 mr-1" />
                                Contact Seller
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setPage(p => p + 1)}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Load More
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
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
