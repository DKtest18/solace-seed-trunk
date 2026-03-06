import { useState } from "react";
import { Star, StarHalf } from "lucide-react";

interface HalfStarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function HalfStarRating({ value, onChange, readonly = false, size = "md" }: HalfStarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  
  const displayValue = hoverValue !== null ? hoverValue : value;
  
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };
  
  const iconSize = sizeClasses[size];
  
  const handleClick = (starIndex: number, isLeftHalf: boolean) => {
    if (readonly || !onChange) return;
    const newValue = isLeftHalf ? starIndex + 0.5 : starIndex + 1;
    onChange(newValue);
  };
  
  const handleMouseMove = (starIndex: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (readonly) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const isLeftHalf = x < rect.width / 2;
    const newValue = isLeftHalf ? starIndex + 0.5 : starIndex + 1;
    setHoverValue(newValue);
  };
  
  const handleMouseLeave = () => {
    if (readonly) return;
    setHoverValue(null);
  };
  
  const renderStar = (index: number) => {
    const starValue = index + 1;
    const fillLevel = displayValue - index;
    
    const isFull = fillLevel >= 1;
    const isHalf = fillLevel >= 0.5 && fillLevel < 1;
    const isEmpty = fillLevel < 0.5;
    
    return (
      <div
        key={index}
        className={`relative ${readonly ? 'cursor-default' : 'cursor-pointer'} transition-transform ${!readonly ? 'hover:scale-110' : ''}`}
        onMouseMove={(e) => handleMouseMove(index, e)}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const isLeftHalf = x < rect.width / 2;
          handleClick(index, isLeftHalf);
        }}
      >
        {/* Background (empty) star */}
        <Star className={`${iconSize} text-muted-foreground/30`} />
        
        {/* Filled star overlay */}
        {isFull && (
          <Star 
            className={`${iconSize} absolute top-0 left-0 fill-yellow-400 text-yellow-400`} 
          />
        )}
        
        {/* Half star overlay */}
        {isHalf && (
          <div className="absolute top-0 left-0 overflow-hidden" style={{ width: '50%' }}>
            <Star 
              className={`${iconSize} fill-yellow-400 text-yellow-400`} 
            />
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="flex gap-0.5 items-center">
      {[0, 1, 2, 3, 4].map(renderStar)}
      {!readonly && (
        <span className="ml-2 text-sm text-muted-foreground">
          {displayValue.toFixed(1)}
        </span>
      )}
    </div>
  );
}