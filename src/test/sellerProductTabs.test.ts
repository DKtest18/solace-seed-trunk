import { describe, expect, it } from 'vitest';
import { REVIEW_STATUS, SELLER_PRODUCT_TAB, classifySellerProduct } from '@/lib/reviewStatus';

describe('classifySellerProduct', () => {
  it('puts a submitted product in In Review even when legacy status says draft', () => {
    expect(classifySellerProduct({ review_status: REVIEW_STATUS.SUBMITTED, status: 'draft' }))
      .toBe(SELLER_PRODUCT_TAB.IN_REVIEW);
  });
  it('keeps drafts in Drafts', () => {
    expect(classifySellerProduct({ review_status: REVIEW_STATUS.DRAFT, status: 'pending' }))
      .toBe(SELLER_PRODUCT_TAB.DRAFT);
  });
  it('in_review counts as In Review', () => {
    expect(classifySellerProduct({ review_status: REVIEW_STATUS.IN_REVIEW })).toBe(SELLER_PRODUCT_TAB.IN_REVIEW);
  });
  it('approved but unpublished lands in Approved, published in Published', () => {
    expect(classifySellerProduct({ review_status: REVIEW_STATUS.APPROVED, is_published: false })).toBe(SELLER_PRODUCT_TAB.APPROVED);
    expect(classifySellerProduct({ review_status: REVIEW_STATUS.APPROVED, is_published: true })).toBe(SELLER_PRODUCT_TAB.PUBLISHED);
  });
  it('changes_requested / rejected land in Changes Requested', () => {
    expect(classifySellerProduct({ review_status: REVIEW_STATUS.CHANGES_REQUESTED })).toBe(SELLER_PRODUCT_TAB.CHANGES_REQUESTED);
    expect(classifySellerProduct({ review_status: REVIEW_STATUS.REJECTED })).toBe(SELLER_PRODUCT_TAB.CHANGES_REQUESTED);
  });
  it('legacy NULL review_status falls back to legacy columns', () => {
    expect(classifySellerProduct({ review_status: null, status: 'pending' })).toBe(SELLER_PRODUCT_TAB.IN_REVIEW);
  });
  it('soft-deleted wins', () => {
    expect(classifySellerProduct({ review_status: REVIEW_STATUS.APPROVED, is_active: false })).toBe(SELLER_PRODUCT_TAB.DELETED);
  });
});
