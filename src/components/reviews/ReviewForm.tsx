import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HalfStarRating } from "./HalfStarRating";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ReviewFormProps {
  productId: string;
  existingReview?: any;
  onSuccess: () => void;
}

export function ReviewForm({ productId, existingReview, onSuccess }: ReviewFormProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in to review");
      return;
    }
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please write a comment");
      return;
    }

    setSubmitting(true);
    try {
      if (existingReview) {
        const { error } = await supabase
          .from("reviews")
          .update({ rating, comment, updated_at: new Date().toISOString() })
          .eq("id", existingReview.id);
        if (error) throw error;
        toast.success("Review updated");
      } else {
        const { error } = await supabase
          .from("reviews")
          .insert({ product_id: productId, user_id: user.id, rating, comment });
        if (error) throw error;
        toast.success("Review submitted");
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
      <div>
        <label className="text-sm font-medium mb-2 block">Your Rating</label>
        <HalfStarRating rating={rating} onRatingChange={setRating} size="lg" />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Your Review</label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this product..."
          rows={4}
          required
        />
      </div>
      <Button type="submit" disabled={submitting || rating === 0}>
        {submitting ? "Submitting..." : existingReview ? "Update Review" : "Submit Review"}
      </Button>
    </form>
  );
}
