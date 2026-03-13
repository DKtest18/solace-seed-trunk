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

  useEffect(() => {
    fetchPosts();
  }, [page]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-community-posts', {
        body: { page, limit: 20 }
      });

      if (error) throw error;

      setPosts(prev => page === 1 ? data.posts : [...prev, ...data.posts]);
      setHasMore(data.has_more);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load community posts',
        variant: 'destructive',
      });
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
