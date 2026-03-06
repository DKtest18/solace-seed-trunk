import { CheckCircle2 } from "lucide-react";

interface VerifiedBadgeProps {
  className?: string;
}

export function VerifiedBadge({ className = "" }: VerifiedBadgeProps) {
  return (
    <span className="inline-flex items-center" title="Verified Email">
      <CheckCircle2 
        className={`h-4 w-4 text-primary ${className}`}
      />
    </span>
  );
}