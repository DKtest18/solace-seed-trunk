import { Star } from 'lucide-react';

interface RatingDisplayProps {
  rating: number;
  count: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export function RatingDisplay({ 
  rating, 
  count, 
  size = 'md', 
  showCount = true 
}: RatingDisplayProps) {
  const starSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  const textSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(rating);
          return (
            <Star
              key={star}
              className={`${starSize} ${
                filled ? 'fill-primary text-primary' : 'text-muted-foreground'
              }`}
            />
          );
        })}
      </div>
      {showCount && (
        <span className={`${textSize} text-muted-foreground`}>
          {rating > 0 ? rating.toFixed(1) : '0.0'} ({count})
        </span>
      )}
    </div>
  );
}
