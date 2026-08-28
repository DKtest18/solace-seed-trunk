import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateReview, useProductReviews, useHasPurchased } from '@/hooks/useReviews';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { HalfStarRating } from './HalfStarRating';
import { HourglassLoader } from '@/components/HourglassLoader';

interface ReviewSectionProps {
  productId: string;
}

export function ReviewSection({ productId }: ReviewSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const { data: reviews, isLoading } = useProductReviews(productId);
  const { data: hasPurchased } = useHasPurchased(productId);
  const createReview = useCreateReview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to leave a review',
        variant: 'destructive',
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: 'Rating required',
        description: 'Please select a rating',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createReview.mutateAsync({ productId, rating, comment });
      toast({
        title: 'Review submitted',
        description: 'Thank you for your feedback!',
      });
      setRating(0);
      setComment('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit review',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Review Form */}
      {user && hasPurchased && (
        <Card>
          <CardHeader>
            <CardTitle>Write a Review</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Your Rating</label>
                <HalfStarRating 
                  value={rating} 
                  onChange={setRating}
                  size="lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Your Review</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience with this product..."
                  rows={4}
                  maxLength={1000}
                />
              </div>

              <Button type="submit" disabled={createReview.isPending}>
                {createReview.isPending ? 'Submitting...' : 'Submit Review'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Customer Reviews</h3>
        {isLoading ? (
          <HourglassLoader size={64} />
        ) : reviews && reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => {
              const profile = review.profiles as unknown as { full_name?: string; avatar_url?: string } | null;
              return (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {profile?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {profile?.full_name || 'Anonymous'}
                            </p>
                            <div className="mt-1">
                              <HalfStarRating value={review.rating} readonly size="sm" />
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(review.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-muted-foreground">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No reviews yet. Be the first to review this product!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
