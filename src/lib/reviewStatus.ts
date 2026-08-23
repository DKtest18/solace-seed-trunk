import {
  REVIEW_STATUS,
  REVIEW_STATUS_GROUPS,
  type ReviewStatusValue,
} from '../../supabase/functions/_shared/review-status';

export { REVIEW_STATUS, REVIEW_STATUS_GROUPS, type ReviewStatusValue };

/**
 * SINGLE SOURCE OF TRUTH for `dkai_products.review_status`.
 *
 * Every read, filter and write in the app must reference these constants —
 * no inline string literals for review status anywhere.
 *
 * Canonical lifecycle:
 *   draft ──submit──> submitted ──admin start──> in_review
 *                                   ├─approve──> approved  (may become locked_exclusive after a buyout)
 *                                   ├─changes──> changes_requested ──resubmit──> submitted
 *                                   └─reject───> rejected           ──resubmit──> submitted
 *   approved ──admin delist──> delisted
 *
 * Legacy values that must NEVER be written again (normalised in SQL):
 *   'pending', 'pending_review', 'reviewing'  -> 'in_review'
 *   'changes-requested', 'needs_changes'      -> 'changes_requested'
 */
export const REVIEW_STATUS_VALUES: ReviewStatusValue[] = Object.values(REVIEW_STATUS);

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  [REVIEW_STATUS.DRAFT]: 'Draft',
  [REVIEW_STATUS.SUBMITTED]: 'Pending review (submitted)',
  [REVIEW_STATUS.IN_REVIEW]: 'In review',
  [REVIEW_STATUS.APPROVED]: 'Approved',
  [REVIEW_STATUS.REJECTED]: 'Rejected',
  [REVIEW_STATUS.CHANGES_REQUESTED]: 'Changes requested',
  [REVIEW_STATUS.LOCKED_EXCLUSIVE]: 'Locked (exclusive)',
  [REVIEW_STATUS.DELISTED]: 'Delisted',
};

export const REVIEW_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  [REVIEW_STATUS.DRAFT]: 'secondary',
  [REVIEW_STATUS.SUBMITTED]: 'default',
  [REVIEW_STATUS.IN_REVIEW]: 'default',
  [REVIEW_STATUS.APPROVED]: 'outline',
  [REVIEW_STATUS.REJECTED]: 'destructive',
  [REVIEW_STATUS.CHANGES_REQUESTED]: 'secondary',
  [REVIEW_STATUS.LOCKED_EXCLUSIVE]: 'outline',
  [REVIEW_STATUS.DELISTED]: 'destructive',
};

/** Maps any legacy/dirty DB value onto the canonical set. */
export function normalizeReviewStatus(value: unknown): ReviewStatusValue {
  const v = String(value ?? '').trim().toLowerCase();
  switch (v) {
    case 'pending':
    case 'pending_review':
    case 'reviewing':
      return REVIEW_STATUS.IN_REVIEW;
    case 'changes-requested':
    case 'needs_changes':
      return REVIEW_STATUS.CHANGES_REQUESTED;
    default:
      return (REVIEW_STATUS_VALUES as readonly string[]).includes(v)
        ? (v as ReviewStatusValue)
        : REVIEW_STATUS.DRAFT;
  }
}

/** True when the product may be shown publicly on the marketplace. */
export function isPubliclyListed(value: unknown): boolean {
  return (REVIEW_STATUS_GROUPS.LIVE as readonly string[]).includes(normalizeReviewStatus(value));
}
