import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePosts, useDeletePost, TimeFilter } from '@/hooks/usePosts';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useHasRole } from '@/hooks/useUserRole';
import { Loader2, Trash2, MessageCircle, Send, Reply, CornerDownRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { moderateContent, validatePostLength } from '@/utils/contentModerationAI';

type PostWithProfile = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  replies?: Comment[];
};

interface PostsFeedProps {
  searchQuery?: string;
}

export function PostsFeed({ searchQuery = '' }: PostsFeedProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasRole: isAdmin } = useHasRole('admin');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const { data: posts, isLoading, refetch } = usePosts(timeFilter);
  const deletePost = useDeletePost();
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);

  // Fetch comments for all posts
  useEffect(() => {
    if (posts && posts.length > 0) {
      fetchCommentsForPosts(posts.map(p => p.id));
    }
  }, [posts]);

  const fetchCommentsForPosts = async (postIds: string[]) => {
    try {
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (commentsData && commentsData.length > 0) {
        // Fetch profiles for comment authors
        const authorIds = [...new Set(commentsData.map(c => c.author_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', authorIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        // Group comments by post_id and organize into hierarchy
        const grouped: Record<string, Comment[]> = {};
        
        commentsData.forEach(c => {
          const commentWithProfile = {
            ...c,
            profiles: profilesMap.get(c.author_id) || null,
            replies: [] as Comment[]
          };
          
          if (!grouped[c.post_id]) grouped[c.post_id] = [];
          grouped[c.post_id].push(commentWithProfile);
        });

        // Organize into nested structure
        Object.keys(grouped).forEach(postId => {
          const allComments = grouped[postId];
          const topLevel: Comment[] = [];
          const repliesMap = new Map<string, Comment[]>();

          allComments.forEach(c => {
            if (!c.parent_comment_id) {
              topLevel.push(c);
            } else {
              const existing = repliesMap.get(c.parent_comment_id) || [];
              existing.push(c);
              repliesMap.set(c.parent_comment_id, existing);
            }
          });

          // Attach replies to parent comments
          topLevel.forEach(parent => {
            parent.replies = repliesMap.get(parent.id) || [];
          });

          grouped[postId] = topLevel;
        });

        setComments(grouped);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmitComment = async (postId: string, parentCommentId?: string) => {
    const content = parentCommentId ? replyContent.trim() : commentInputs[postId]?.trim();
    if (!user || !content) return;

    // AI content moderation check
    const moderationResult = moderateContent(content);
    if (!moderationResult.isClean) {
      toast({
        title: 'Content Blocked',
        description: moderationResult.reason || 'Your message violates the platform rules.',
        variant: 'destructive',
      });
      return;
    }

    if (parentCommentId) {
      setSubmittingReply(true);
    } else {
      setSubmittingComment(prev => ({ ...prev, [postId]: true }));
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content,
          parent_comment_id: parentCommentId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh comments
      await fetchCommentsForPosts([postId]);
      
      if (parentCommentId) {
        setReplyContent('');
        setReplyingTo(null);
        toast({ title: 'Reply posted' });
      } else {
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        toast({ title: 'Comment posted' });
      }
    } catch (error: any) {
      console.error('Error posting comment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to post comment',
        variant: 'destructive',
      });
    } finally {
      if (parentCommentId) {
        setSubmittingReply(false);
      } else {
        setSubmittingComment(prev => ({ ...prev, [postId]: false }));
      }
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await deletePost.mutateAsync(postId);
      toast({
        title: 'Post deleted',
        description: 'Your post has been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive',
      });
    }
  };

  // Delete comment handler with cascade for replies
  const handleDeleteComment = async (commentId: string, postId: string) => {
    if (!user) return;
    setDeletingComment(commentId);
    try {
      // First delete all replies to this comment
      const { error: repliesError } = await supabase
        .from('comments')
        .delete()
        .eq('parent_comment_id', commentId);

      if (repliesError) throw repliesError;

      // Then delete the comment itself
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      
      // Update local state immediately for instant UI feedback
      setComments(prev => {
        const updated = { ...prev };
        if (updated[postId]) {
          // Remove from top-level comments
          updated[postId] = updated[postId].filter(c => c.id !== commentId);
          // Remove from replies
          updated[postId] = updated[postId].map(c => ({
            ...c,
            replies: c.replies?.filter(r => r.id !== commentId) || []
          }));
        }
        return updated;
      });
      
      toast({ title: 'Comment deleted' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete comment',
        variant: 'destructive',
      });
      // Refetch on error to sync state
      await fetchCommentsForPosts([postId]);
    } finally {
      setDeletingComment(null);
    }
  };

  // Render text with highlighted mentions as clickable links
  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1); // Remove @ symbol
        return (
          <Link
            key={index}
            to={`/profile/${username}`}
            className="text-primary font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  // Check if user can delete a comment (owner, post owner, or admin)
  const canDeleteComment = (comment: Comment, postOwnerId: string) => {
    if (!user) return false;
    return user.id === comment.author_id || user.id === postOwnerId || isAdmin;
  };

  const renderComment = (comment: Comment, postId: string, postOwnerId: string, isReply = false) => (
    <div key={comment.id} className={`flex gap-2 ${isReply ? 'ml-8 mt-2' : ''}`}>
      {isReply && <CornerDownRight className="h-3 w-3 text-muted-foreground mt-2 flex-shrink-0" />}
      <Link to={`/profile/${comment.author_id}`}>
        <Avatar className={`cursor-pointer hover:opacity-80 ${isReply ? 'h-5 w-5' : 'h-6 w-6'}`}>
          <AvatarImage src={comment.profiles?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">
            {comment.profiles?.full_name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Link to={`/profile/${comment.author_id}`}>
            <span className="text-sm font-medium hover:underline">
              {comment.profiles?.full_name || comment.profiles?.username || 'Anonymous'}
            </span>
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{renderTextWithMentions(comment.content)}</p>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-1">
          {!isReply && user && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-foreground p-0"
              onClick={() => {
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                setReplyContent('');
              }}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
          )}
          {canDeleteComment(comment, postOwnerId) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive hover:text-destructive p-0"
              onClick={() => handleDeleteComment(comment.id, postId)}
              disabled={deletingComment === comment.id}
            >
              {deletingComment === comment.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>

        {/* Reply input */}
        {replyingTo === comment.id && (
          <div className="mt-2 flex gap-2">
            <Input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 h-7 text-sm"
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && replyContent.trim()) {
                  e.preventDefault();
                  handleSubmitComment(postId, comment.id);
                }
              }}
            />
            <Button
              size="sm"
              className="h-7"
              onClick={() => handleSubmitComment(postId, comment.id)}
              disabled={!replyContent.trim() || submittingReply}
            >
              {submittingReply ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => {
                setReplyingTo(null);
                setReplyContent('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => renderComment(reply, postId, postOwnerId, true))}
          </div>
        )}
      </div>
    </div>
  );

  // Count total comments including replies
  const getTotalCommentCount = (postId: string) => {
    const postComments = comments[postId] || [];
    let total = postComments.length;
    postComments.forEach(c => {
      total += c.replies?.length || 0;
    });
    return total;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter posts by search query
  const filteredPosts = posts?.filter((post) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const content = post.content.toLowerCase();
    const userName = (post.profiles?.full_name || post.profiles?.username || '').toLowerCase();
    return content.includes(searchLower) || userName.includes(searchLower);
  });

  return (
    <div className="space-y-4">
      <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {filteredPosts && filteredPosts.length > 0 ? (
          (filteredPosts as unknown as PostWithProfile[]).map((post) => (
            <Card key={post.id}>
              <CardHeader>
                  <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Link to={`/profile/${post.user_id}`}>
                      <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage src={post.profiles?.avatar_url || undefined} />
                        <AvatarFallback>
                          {post.profiles?.full_name?.[0] || post.profiles?.username?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <Link to={`/profile/${post.user_id}`}>
                        <p className="font-semibold hover:underline cursor-pointer">
                          {post.profiles?.full_name || post.profiles?.username || 'Anonymous'}
                        </p>
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {user?.id === post.user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(post.id)}
                      disabled={deletePost.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap">{renderTextWithMentions(post.content)}</p>
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post image"
                    className="w-full rounded-lg max-h-96 object-cover"
                  />
                )}
              </CardContent>
              
              {/* Comments Section */}
              <CardFooter className="flex-col items-stretch border-t pt-4 space-y-3">
                {/* Comment count toggle */}
                <button
                  onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  {getTotalCommentCount(post.id)} comments
                </button>

                {/* Expanded comments list with nested replies */}
                {expandedComments[post.id] && comments[post.id] && comments[post.id].length > 0 && (
                  <div className="space-y-3 pl-2 border-l-2 border-muted">
                    {comments[post.id].map((comment) => renderComment(comment, post.id, post.user_id))}
                  </div>
                )}

                {/* Comment input */}
                {user ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Write a comment... (use @ to mention)"
                      value={commentInputs[post.id] || ''}
                      onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitComment(post.id);
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      onClick={() => handleSubmitComment(post.id)}
                      disabled={!commentInputs[post.id]?.trim() || submittingComment[post.id]}
                    >
                      {submittingComment[post.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <Link to="/login" className="text-primary hover:underline">Log in</Link> to comment
                  </p>
                )}
              </CardFooter>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No posts found for this time period
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
