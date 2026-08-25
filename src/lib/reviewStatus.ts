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

/* ---------------------------------------------------------------------------
 * Seller "My Products" tabs — single source of truth.
 *
 * The seller tabs, the admin queue and the submit action all derive from
 * REVIEW_STATUS. Legacy columns (`status`, `approval_status`,
 * `moderation_status`) are NEVER used to decide a bucket; they are only a
 * fallback when review_status is NULL on very old rows.
 * ------------------------------------------------------------------------- */
export const SELLER_PRODUCT_TAB = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved_pending_publish',
  PUBLISHED: 'published',
  CHANGES_REQUESTED: 'rejected',
  DELETED: 'deleted',
} as const;

export type SellerProductTab = (typeof SELLER_PRODUCT_TAB)[keyof typeof SELLER_PRODUCT_TAB];

export const SELLER_PRODUCT_TABS: SellerProductTab[] = Object.values(SELLER_PRODUCT_TAB);

/** Canonical review status of a product row, ignoring legacy columns unless review_status is NULL. */
export function productReviewStatus(p: any): ReviewStatusValue {
  const raw = p?.review_status;
  if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
    return normalizeReviewStatus(raw);
  }
  // Legacy rows only.
  return normalizeReviewStatus(p?.approval_status ?? p?.status);
}

/** Buyable = publicly listed review status AND published flag. */
export function isProductBuyable(p: any): boolean {
  return p?.is_published === true && isPubliclyListed(productReviewStatus(p));
}

/** Which seller tab a product belongs to. */
export function classifySellerProduct(p: any): SellerProductTab {
  if (p?.is_active === false || p?.deleted_at) return SELLER_PRODUCT_TAB.DELETED;
  const review = productReviewStatus(p);

  if ((REVIEW_STATUS_GROUPS.NEEDS_SELLER_ACTION as readonly string[]).includes(review)) {
    return SELLER_PRODUCT_TAB.CHANGES_REQUESTED;
  }
  if ((REVIEW_STATUS_GROUPS.PENDING as readonly string[]).includes(review)) {
    return SELLER_PRODUCT_TAB.IN_REVIEW;
  }
  if ((REVIEW_STATUS_GROUPS.LIVE as readonly string[]).includes(review)) {
    return isProductBuyable(p) ? SELLER_PRODUCT_TAB.PUBLISHED : SELLER_PRODUCT_TAB.APPROVED;
  }
  if (review === REVIEW_STATUS.DELISTED) return SELLER_PRODUCT_TAB.CHANGES_REQUESTED;
  return SELLER_PRODUCT_TAB.DRAFT;
}
