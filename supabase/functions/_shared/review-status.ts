/** Canonical values for public.dkai_products.review_status in Edge Functions. */
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

export const REVIEW_STATUS_GROUPS = {
  PENDING: [REVIEW_STATUS.SUBMITTED, REVIEW_STATUS.IN_REVIEW],
  LIVE: [REVIEW_STATUS.APPROVED, REVIEW_STATUS.LOCKED_EXCLUSIVE],
  NEEDS_SELLER_ACTION: [REVIEW_STATUS.REJECTED, REVIEW_STATUS.CHANGES_REQUESTED],
  DRAFT: [REVIEW_STATUS.DRAFT],
  DELISTED: [REVIEW_STATUS.DELISTED],
} as const;

export type ReviewStatusValue = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];