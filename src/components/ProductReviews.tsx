import { useState, useEffect } from "react";
import { db } from "@/lib/dkaiDb";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Loader2, Edit2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { HalfStarRating } from "@/components/HalfStarRating";

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface ProductReviewsProps {
  productId: string;
  sellerId: string;
}

export function ProductReviews({ productId, sellerId }: ProductReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchReviews();
    if (user) {
      checkCanReview();
    }
  }, [productId, user]);

  const fetchReviews = async () => {
    try {
      // First get reviews
      const { data: reviewsData, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Then fetch profiles for each review
      if (reviewsData && reviewsData.length > 0) {
        const userIds = [...new Set(reviewsData.map(r => r.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const reviewsWithProfiles = reviewsData.map(r => ({
          ...r,
          profiles: profilesMap.get(r.user_id) || null
        }));
        
        setReviews(reviewsWithProfiles);
        
        // Find user's own review if exists
        if (user) {
          const own = reviewsWithProfiles.find(r => r.user_id === user.id);
          if (own) {
            setUserReview(own);
            setRating(own.rating);
            setComment(own.comment || "");
          }
        }
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkCanReview = async () => {
    if (!user) return;
    
    // Can't review own products
    if (user.id === sellerId) {
      setCanReview(false);
      return;
    }

    // Check if user has purchased this product (must match RLS policy statuses)
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("product_id", productId)
      .eq("buyer_id", user.id)
      .in("status", ["paid", "completed", "delivered", "payment_confirmed", "invoice_sent"])
      .limit(1);

    setCanReview((orders?.length || 0) > 0);
  };

  const updateProductRating = async () => {
    // Calculate and update product's cached rating
    const { data: allReviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("product_id", productId);

    if (allReviews) {
      const count = allReviews.length;
      const avg = count > 0 
        ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
        : 0;
      
      await supabase
        .from("products")
        .update({ 
          average_rating: avg, 
          ratings_count: count,
          updated_at: new Date().toISOString()
        })
        .eq("id", productId);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || rating < 0.5 || rating > 5) return;

    setSubmitting(true);
    try {
      if (editing && userReview) {
        // Update existing review
        const { error } = await supabase
          .from("reviews")
          .update({
            rating,
            comment: comment.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userReview.id);

        if (error) throw error;
        toast.success("Review updated successfully");
      } else {
        // Create new review
        const { error } = await supabase
          .from("reviews")
          .insert({
            product_id: productId,
            user_id: user.id,
            rating,
            comment: comment.trim() || null,
          });

        if (error) throw error;
        toast.success("Review submitted successfully");
      }

      setShowForm(false);
      setEditing(false);
      await fetchReviews();
      await updateProductRating();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast.error(error.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!userReview) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", userReview.id);

      if (error) throw error;
      
      toast.success("Review deleted");
      setUserReview(null);
      setRating(5);
      setComment("");
      await fetchReviews();
      await updateProductRating();
    } catch (error: any) {
      console.error("Error deleting review:", error);
      toast.error(error.message || "Failed to delete review");
    } finally {
      setSubmitting(false);
    }
  };

  // StarRating component for readonly display (integer stars)
  const StarRatingDisplay = ({ value }: { value: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fillLevel = value - (star - 1);
        const isFull = fillLevel >= 1;
        const isHalf = fillLevel >= 0.5 && fillLevel < 1;
        
        return (
          <div key={star} className="relative">
            <Star className="h-4 w-4 text-muted-foreground/30" />
            {isFull && (
              <Star className="h-4 w-4 absolute top-0 left-0 fill-yellow-400 text-yellow-400" />
            )}
            {isHalf && (
              <div className="absolute top-0 left-0 overflow-hidden" style={{ width: '50%' }}>
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Calculate average rating
  const avgRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 0;

  // Always show the reviews section (visible to everyone)

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Reviews ({reviews.length})
          </div>
          {reviews.length > 0 && (
          <div className="flex items-center gap-2 text-sm font-normal">
              <StarRatingDisplay value={avgRating} />
              <span>{avgRating.toFixed(1)} average</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Review form for eligible users - visible to all but disabled for non-buyers */}
        {!userReview && !showForm && (
          <div className="space-y-2">
            <Button 
              onClick={() => setShowForm(true)} 
              variant="outline"
              disabled={!canReview}
            >
              Write a Review
            </Button>
            {!canReview && user && user.id !== sellerId && (
              <p className="text-sm text-muted-foreground">
                Purchase this product to leave a review
              </p>
            )}
          </div>
        )}

        {/* User's existing review with edit/delete options */}
        {userReview && !editing && (
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Review</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                    setShowForm(true);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteReview}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
            <StarRatingDisplay value={userReview.rating} />
            {userReview.comment && <p className="text-sm">{userReview.comment}</p>}
          </div>
        )}

        {/* Review form */}
        {(showForm || editing) && (
          <div className="p-4 border rounded-lg space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating (supports half stars)</label>
              <HalfStarRating value={rating} onChange={setRating} size="lg" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Comment (optional)</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this product..."
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmitReview} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editing ? "Update Review" : "Submit Review"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditing(false);
                  if (userReview) {
                    setRating(userReview.rating);
                    setComment(userReview.comment || "");
                  }
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reviews list */}
        {reviews.length > 0 && (
          <div className="space-y-4">
            {reviews.filter(r => r.user_id !== user?.id).map((review) => (
              <div key={review.id} className="flex gap-4 p-4 border rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={review.profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {review.profiles?.full_name || review.profiles?.username || "Anonymous"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <StarRatingDisplay value={review.rating} />
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {reviews.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No reviews yet. {!canReview && "Be the first to buy this product and leave a review!"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
