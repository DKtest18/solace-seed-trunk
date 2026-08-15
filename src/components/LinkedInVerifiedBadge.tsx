import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Trust signal shown next to a user's name when their account is linked to
 * a real LinkedIn identity (dkai_profiles.is_linkedin_verified === true).
 */
export function LinkedInVerifiedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const text = size === 'sm' ? 'text-xs' : 'text-sm';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-[#0A66C2]/10 px-2.5 py-1 font-medium text-[#0A66C2] ${text}`}
        >
          <BadgeCheck className={icon} aria-hidden="true" />
          Verified via LinkedIn
        </span>
      </TooltipTrigger>
      <TooltipContent>
        This member signed in with LinkedIn — their identity is confirmed by LinkedIn.
      </TooltipContent>
    </Tooltip>
  );
}
