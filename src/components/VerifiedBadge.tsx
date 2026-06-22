import { BadgeCheck, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  verified?: boolean;
  founding?: boolean;
  size?: "sm" | "md";
};

/**
 * VerifiedBadge - shows trust signals on profiles & product cards.
 * - `verified`: seller has completed KYC / Stripe onboarding.
 * - `founding`: dkai_profiles.seller_type === 'founding'.
 */
export function VerifiedBadge({ verified, founding, size = "sm" }: Props) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {verified && (
        <Tooltip>
          <TooltipTrigger asChild>
            <BadgeCheck className={`${iconSize} text-blue-600`} aria-label="Verified seller" />
          </TooltipTrigger>
          <TooltipContent>Verified seller — identity & payout account confirmed</TooltipContent>
        </Tooltip>
      )}
      {founding && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Sparkles className={`${iconSize} text-amber-500`} aria-label="Founding seller" />
          </TooltipTrigger>
          <TooltipContent>Founding seller — one of the first on DK AI Marketplace</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
