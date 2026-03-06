import { HalfStarRating } from "./HalfStarRating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Trash2, Edit2 } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

interface ReviewsListProps {
  reviews: Review[];
  currentUserId?: string;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: string) => void;
}

export function ReviewsList({ reviews, currentUserId, onEdit, onDelete }: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No reviews yet. Be the first to review!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="border rounded-lg p-4 bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 flex-1">
              <Avatar>
                <AvatarImage src={review.profiles?.avatar_url} />
                <AvatarFallback>
                  {review.profiles?.full_name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{review.profiles?.full_name || "Anonymous"}</span>
                  {review.is_verified_purchase && (
                    <Badge variant="secondary" className="text-xs">Verified Purchase</Badge>
                  )}
                </div>
                <HalfStarRating rating={review.rating} readonly size="sm" />
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                </p>
                <p className="mt-2 text-sm">{review.comment}</p>
              </div>
            </div>
            {currentUserId === review.user_id && (
              <div className="flex gap-2">
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(review)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(review.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
