import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';

export interface SellerAcceptedMethods {
  stripe: boolean;
  paypal: boolean;
}

/**
 * Which providers a seller lets buyers use at checkout.
 * Guests may not be able to read the config table — in that case we fall back
 * to "cards only" and let the edge function be the source of truth.
 */
export async function fetchSellerAcceptedMethods(sellerId: string): Promise<SellerAcceptedMethods> {
  try {
    const { data, error } = await db
      .from('dkai_seller_payment_configs')
      .select('accepts_stripe, accepts_paypal, paypal_onboarding_status, paypal_payments_receivable')
      .eq('seller_id', sellerId)
      .maybeSingle();
    if (error || !data) return { stripe: true, paypal: false };
    const paypalReady =
      !!data.paypal_payments_receivable && data.paypal_onboarding_status === 'connected';
    return {
      stripe: data.accepts_stripe !== false,
      paypal: data.accepts_paypal !== false && paypalReady,
    };
  } catch {
    return { stripe: true, paypal: false };
  }
}

export interface CreatePayPalOrderInput {
  productId: string;
  licenseTier: string;
  couponCode?: string;
  referralSource?: string;
  ipAssignmentAccepted?: boolean;
  origin: string;
}

/** Creates a PayPal order server-side and returns the buyer approval URL. */
export async function createPayPalOrder(input: CreatePayPalOrderInput): Promise<{
  approveUrl: string;
  paypalOrderId: string;
  orderId: string;
}> {
  const { data, error } = await supabase.functions.invoke('paypal-create-order', {
    body: {
      product_id: input.productId,
      license_tier: input.licenseTier,
      coupon_code: input.couponCode,
      referral_source: input.referralSource,
      ip_assignment_accepted: input.ipAssignmentAccepted,
      origin: input.origin,
    },
  });

  let serverError: string | undefined;
  const ctx: any = (error as any)?.context;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const body = await ctx.clone().json();
      serverError = body?.error || body?.paypal_error || body?.message;
    } catch {
      try { serverError = await ctx.clone().text(); } catch { /* ignore */ }
    }
  }
  if (!serverError && (data as any)?.error) serverError = (data as any).error;

  const approveUrl = (data as any)?.approve_url || (data as any)?.approveUrl;
  if (error || !approveUrl) {
    throw new Error(serverError || (error as any)?.message || 'Could not start PayPal checkout');
  }
  return {
    approveUrl,
    paypalOrderId: (data as any).paypal_order_id,
    orderId: (data as any).order_id,
  };
}

/** Captures an approved PayPal order (platform fee included server-side). */
export async function capturePayPalOrder(params: {
  paypalOrderId: string;
  orderId?: string;
}): Promise<{ orderId: string; status: string }> {
  const { data, error } = await supabase.functions.invoke('paypal-capture-order', {
    body: { paypal_order_id: params.paypalOrderId, order_id: params.orderId },
  });

  let serverError: string | undefined;
  const ctx: any = (error as any)?.context;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const body = await ctx.clone().json();
      serverError = body?.error || body?.paypal_error || body?.message;
    } catch { /* ignore */ }
  }
  if (!serverError && (data as any)?.error) serverError = (data as any).error;
  if (error || !(data as any)?.success) {
    throw new Error(serverError || (error as any)?.message || 'PayPal payment could not be completed');
  }
  return { orderId: (data as any).order_id, status: (data as any).status ?? 'paid' };
}
