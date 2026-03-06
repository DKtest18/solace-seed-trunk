import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface HalfStarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function HalfStarRating({ rating, onRatingChange, readonly = false, size = "md" }: HalfStarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };

  const renderStar = (index: number) => {
    const fillAmount = Math.max(0, Math.min(1, (hoverRating || rating) - index));
    
    return (
      <button
        key={index}
        type="button"
        disabled={readonly}
        className={cn(
          "relative transition-transform",
          !readonly && "hover:scale-110 cursor-pointer"
        )}
        onMouseEnter={() => !readonly && setHoverRating(index + 1)}
        onMouseLeave={() => !readonly && setHoverRating(0)}
        onClick={() => {
          if (!readonly && onRatingChange) {
            onRatingChange(index + 1);
          }
        }}
        onMouseMove={(e) => {
          if (readonly) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const isHalf = x < rect.width / 2;
          setHoverRating(index + (isHalf ? 0.5 : 1));
        }}
      >
        <Star className={cn(sizeClasses[size], "text-muted-foreground")} />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${fillAmount * 100}%` }}
        >
          <Star className={cn(sizeClasses[size], "fill-yellow-400 text-yellow-400")} />
        </div>
      </button>
    );
  };

  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3, 4].map(renderStar)}
    </div>
  );
}
