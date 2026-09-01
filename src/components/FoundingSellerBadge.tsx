import { Crown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Permanent marker for one of the (max 5) early sellers on the platform.
 * Purely a marker — it carries no fee meaning once the seller's first four
 * completed sales are used.
 */
export function FoundingSellerBadge({ className = '' }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ${className}`}
          >
            <Crown className="h-3.5 w-3.5" aria-hidden />
            Founding Seller
          </span>
        </TooltipTrigger>
        <TooltipContent>One of the first sellers on DK AI Marketplace.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
