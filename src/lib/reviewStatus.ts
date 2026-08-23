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
export const REVIEW_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CHANGES_REQUESTED: 'changes_requested',
  LOCKED_EXCLUSIVE: 'locked_exclusive',
  DELISTED: 'delisted',
} as const;

export type ReviewStatusValue = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

export const REVIEW_STATUS_VALUES: ReviewStatusValue[] = Object.values(REVIEW_STATUS);

/** Groups used by queues, badges and marketplace visibility. */
export const REVIEW_STATUS_GROUPS = {
  /** Waiting for an admin decision. */
  PENDING: [REVIEW_STATUS.SUBMITTED, REVIEW_STATUS.IN_REVIEW] as ReviewStatusValue[],
  /** Seller must act. */
  NEEDS_SELLER_ACTION: [REVIEW_STATUS.REJECTED, REVIEW_STATUS.CHANGES_REQUESTED] as ReviewStatusValue[],
  /** Publicly listed (buyability is decided separately by dkai_product_purchasable). */
  LIVE: [REVIEW_STATUS.APPROVED, REVIEW_STATUS.LOCKED_EXCLUSIVE] as ReviewStatusValue[],
  /** Not submitted yet. */
  DRAFT: [REVIEW_STATUS.DRAFT] as ReviewStatusValue[],
  /** Removed from the marketplace by an admin. */
  DELISTED: [REVIEW_STATUS.DELISTED] as ReviewStatusValue[],
} as const;

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
      return (REVIEW_STATUS_VALUES as string[]).includes(v)
        ? (v as ReviewStatusValue)
        : REVIEW_STATUS.DRAFT;
  }
}

/** True when the product may be shown publicly on the marketplace. */
export function isPubliclyListed(value: unknown): boolean {
  return (REVIEW_STATUS_GROUPS.LIVE as string[]).includes(normalizeReviewStatus(value));
}
