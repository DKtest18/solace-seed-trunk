import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Eye, MessageCircle, Paperclip, Send, Download, Reply, CornerDownRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ClickableAvatar } from '@/components/ClickableAvatar';
import { useToast } from '@/hooks/use-toast';
import { MentionInput } from '@/components/MentionInput';

interface CommentType {
  id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  author: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  is_author: boolean;
  replies?: CommentType[];
}

interface PostDetail {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  views_count: number;
  comments_count: number;
  has_attachment: boolean;
  attachment_file_name: string | null;
  attachment_storage_key: string | null;
  download_allowed: boolean;
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
  is_author: boolean;
  comments: CommentType[];
}

export default function CommunityPost() {
  const { postId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyMentions, setReplyMentions] = useState<string[]>([]);
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  // Group comments into parent comments with replies
  const groupedComments = post?.comments ? (() => {
    const topLevel: CommentType[] = [];
    const repliesMap = new Map<string, CommentType[]>();

    post.comments.forEach(c => {
      if (!c.parent_comment_id) {
        topLevel.push({ ...c, replies: [] });
      } else {
        const existing = repliesMap.get(c.parent_comment_id) || [];
        existing.push(c);
        repliesMap.set(c.parent_comment_id, existing);
      }
    });

    // Attach replies to their parent comments
    topLevel.forEach(parent => {
      parent.replies = repliesMap.get(parent.id) || [];
    });

    return topLevel;
  })() : [];

  const fetchPost = async () => {
    if (!postId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-community-post', {
        body: { post_id: postId }
      });

      if (error) throw error;
      setPost(data);
    } catch (error) {
      console.error('Error fetching post:', error);
      toast({
        title: 'Error',
        description: 'Failed to load post',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContactSeller = async () => {
    if (!user || !post?.seller_id) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-message-thread', {
        body: {
          recipient_id: post.seller_id,
          product_id: post.product?.id || undefined,
        }
      });

      if (error) throw error;
      navigate(`/messages?thread=${data.thread_id}`);
    } catch (error) {
      console.error('Error creating thread:', error);
      toast({
        title: 'Error',
        description: 'Failed to start conversation',
        variant: 'destructive',
      });
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !postId || !comment.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('create-community-comment', {
        body: {
          post_id: postId,
          content: comment.trim(),
          mentions: commentMentions,
        }
      });

      if (error) throw error;

      setComment('');
      setCommentMentions([]);
      fetchPost(); // Refresh to show new comment
      toast({
        title: 'Comment posted',
        description: 'Your comment has been added',
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentCommentId: string) => {
    if (!user || !postId || !replyContent.trim()) return;

    setSubmittingReply(true);
    try {
      const { error } = await supabase.functions.invoke('create-community-comment', {
        body: {
          post_id: postId,
          content: replyContent.trim(),
          parent_comment_id: parentCommentId,
          mentions: replyMentions,
        }
      });

      if (error) throw error;

      setReplyContent('');
      setReplyMentions([]);
      setReplyingTo(null);
      fetchPost(); // Refresh to show new reply
      toast({
        title: 'Reply posted',
        description: 'Your reply has been added',
      });
    } catch (error) {
      console.error('Error posting reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to post reply',
        variant: 'destructive',
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDownloadAttachment = async () => {
    if (!post?.attachment_storage_key) return;

    try {
      const { data, error } = await supabase.functions.invoke('generate-signed-url', {
        body: { key: post.attachment_storage_key }
      });

      if (error) throw error;

      // Open signed URL in new tab
      window.open(data.signed_url, '_blank');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast({
        title: 'Error',
        description: 'Failed to download attachment',
        variant: 'destructive',
      });
    }
  };

// Helper to render text with highlighted mentions as clickable links
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

  const renderComment = (commentItem: CommentType, isReply = false) => (
    <div key={commentItem.id} className={`flex gap-3 ${isReply ? 'ml-10 mt-3' : ''}`}>
      {isReply && <CornerDownRight className="h-4 w-4 text-muted-foreground mt-2 flex-shrink-0" />}
      {commentItem.author && (
        <ClickableAvatar
          userId={commentItem.author.id}
          avatarUrl={commentItem.author.avatar_url}
          username={commentItem.author.username || commentItem.author.full_name}
          size="sm"
        />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Link
            to={`/profile/${commentItem.author?.id}`}
            className="font-semibold text-sm hover:underline"
          >
            {commentItem.author?.full_name || commentItem.author?.username || 'Anonymous'}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(commentItem.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap mb-2">
          {renderTextWithMentions(commentItem.content)}
        </p>
        {!isReply && user && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setReplyingTo(replyingTo === commentItem.id ? null : commentItem.id);
              setReplyContent('');
            }}
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>
        )}
        
        {/* Reply input */}
        {replyingTo === commentItem.id && (
          <div className="mt-2 flex gap-2">
            <Input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 h-8 text-sm"
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && replyContent.trim()) {
                  e.preventDefault();
                  handleReplySubmit(commentItem.id);
                }
              }}
            />
            <Button
              size="sm"
              className="h-8"
              onClick={() => handleReplySubmit(commentItem.id)}
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
              className="h-8"
              onClick={() => {
                setReplyingTo(null);
                setReplyContent('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Replies */}
        {commentItem.replies && commentItem.replies.length > 0 && (
          <div className="mt-2 space-y-3">
            {commentItem.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Post not found</h1>
            <Button onClick={() => navigate('/community')}>Back to Community</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Button variant="ghost" onClick={() => navigate('/community')} className="mb-4">
            ← Back to Community
          </Button>

          {/* Main Post */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start gap-4">
                {post.author && (
                  <ClickableAvatar
                    userId={post.author.id}
                    avatarUrl={post.author.avatar_url}
                    username={post.author.username || post.author.full_name}
                    size="lg"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Link
                      to={`/profile/${post.author?.id}`}
                      className="font-semibold text-lg hover:underline"
                    >
                      {post.author?.full_name || post.author?.username || 'Anonymous'}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {post.title && <h1 className="text-3xl font-bold mb-4">{post.title}</h1>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap mb-6">{post.body}</p>

              {/* Attachment */}
              {post.has_attachment && post.download_allowed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadAttachment}
                  className="mb-4"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download {post.attachment_file_name}
                </Button>
              )}

              {/* Product Card */}
              {post.product && (
                <Link to={`/product/${post.product.id}`}>
                  <Card className="mb-4 hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      {post.product.image_url && (
                        <img
                          src={post.product.image_url}
                          alt={post.product.title}
                          className="w-20 h-20 object-cover rounded"
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

              {/* Stats & Actions */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {post.views_count} views
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  {post.comments_count} comments
                </span>
                {post.can_message_seller && (
                  <Button size="sm" onClick={handleContactSeller}>
                    <MessageCircle className="h-3 w-3 mr-1" />
                    Contact Seller
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold">Comments ({post.comments_count})</h2>
            </CardHeader>
            <CardContent>
              {/* Comment Form */}
              {user ? (
                <form onSubmit={handleCommentSubmit} className="mb-6">
                  <MentionInput
                    value={comment}
                    onChange={(value, mentions) => {
                      setComment(value);
                      setCommentMentions(mentions);
                    }}
                    placeholder="Add a comment... Use @ to mention users"
                    rows={3}
                    maxLength={2000}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">
                      {comment.length} / 2000 {commentMentions.length > 0 && `• ${commentMentions.length} mention(s)`}
                    </span>
                    <Button type="submit" disabled={!comment.trim() || submitting}>
                      {submitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Post Comment
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="mb-6 p-4 bg-muted rounded-lg text-center">
                  <p className="text-muted-foreground mb-2">Please log in to comment</p>
                  <Button size="sm" onClick={() => navigate('/login')}>
                    Log In
                  </Button>
                </div>
              )}

              <Separator className="my-6" />

              {/* Comments List with nested replies */}
              <div className="space-y-6">
                {groupedComments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  groupedComments.map((commentItem) => renderComment(commentItem))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
