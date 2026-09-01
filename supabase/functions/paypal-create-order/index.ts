import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { getPlatformFeePercent } from "../_shared/platform-fee.ts";


export const config = {
  verify_jwt: false,
};

type LicenseTier = "personal" | "commercial" | "agency" | "exclusive";

type CreateOrderBody = {
  product_id?: string;
  license_tier?: LicenseTier;
  coupon_code?: string;
  referral_source?: string;
  ip_assignment_accepted?: boolean;
  origin?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PAYPAL_CLIENT_ID = Deno.env.get("DKAIM_PAYPAL_CLIENT_ID");
const PAYPAL_SECRET = Deno.env.get("DKAIM_PAYPAL_SECRET");
const PAYPAL_ENV = (Deno.env.get("DKAIM_PAYPAL_ENV") ?? "sandbox").toLowerCase();
const PAYPAL_BN_CODE = Deno.env.get("DKAIM_PAYPAL_BN_CODE") ?? "";

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
if (!PAYPAL_CLIENT_ID) throw new Error("DKAIM_PAYPAL_CLIENT_ID is required");
if (!PAYPAL_SECRET) throw new Error("DKAIM_PAYPAL_SECRET is required");

const PAYPAL_BASE_URL = PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
const IS_SANDBOX = PAYPAL_ENV !== "live";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const NOT_PURCHASABLE_MESSAGE =
  "This product is not yet available for purchase — the seller has not connected a payment provider (Stripe or PayPal) yet.";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function isProductPurchasable(
  admin: ReturnType<typeof createClient>,
  productId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!productId) return { ok: false, reason: "productId required" };

  const { data, error } = await admin.rpc("dkai_product_purchasable", {
    p_product_id: productId,
  });

  if (error) {
    return { ok: false, reason: `Purchase check failed: ${error.message}` };
  }

  if (data !== true) {
    return { ok: false, reason: NOT_PURCHASABLE_MESSAGE };
  }

  return { ok: true };
}

function parsePayPalError(raw: any) {
  const details = raw?.details;
  const message = raw?.message ?? raw?.error_description ?? "PayPal request failed";
  return { message, details, raw };
}

function toMoney2(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function clampNonNegative(value: number) {
  return value < 0 ? 0 : value;
}

function resolveTierPrice(product: any, tier: LicenseTier): number | null {
  const fallback = Number(product.price ?? 0);

  if (tier === "personal") {
    if (product.license_personal_enabled === false) return null;
    const v = product.license_personal_price;
    return Number(v ?? fallback);
  }
  if (tier === "commercial") {
    if (product.license_commercial_enabled !== true) return null;
    const v = product.license_commercial_price;
    return Number(v ?? fallback);
  }
  if (tier === "agency") {
    if (product.license_agency_enabled !== true) return null;
    const v = product.license_agency_price;
    return Number(v ?? fallback);
  }
  if (tier === "exclusive") {
    if (product.license_exclusive_enabled !== true) return null;
    const v = product.license_exclusive_price;
    return Number(v ?? fallback);
  }
  return null;
}

async function getOAuthToken() {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
  const resp = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.access_token) {
    const parsed = parsePayPalError(data);
    return { error: parsed, accessToken: null as string | null };
  }

  return { error: null, accessToken: data.access_token as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    let buyerId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.slice("Bearer ".length).trim();
      if (jwt) {
        const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
        if (userErr) {
          return jsonResponse({ error: "Invalid JWT" }, 401);
        }
        buyerId = userData.user?.id ?? null;
      }
    }

    const body = (await req.json()) as CreateOrderBody;
    const productId = body.product_id;
    const licenseTier = body.license_tier;
    const couponCode = body.coupon_code?.trim();
    const referralSource = body.referral_source?.trim() || null;
    const ipAccepted = body.ip_assignment_accepted === true;
    const origin = body.origin?.trim();

    if (!productId || !licenseTier || !origin) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      return jsonResponse({ error: "Invalid origin" }, 400);
    }

    if (!["personal", "commercial", "agency", "exclusive"].includes(licenseTier)) {
      return jsonResponse({ error: "Invalid license tier" }, 400);
    }

    const guard = await isProductPurchasable(supabase, productId);
    if (!guard.ok) {
      return jsonResponse({ error: guard.reason ?? "Product is not available for purchase" }, 400);
    }

    const { data: product, error: productErr } = await supabase
      .from("dkai_products")
      .select("id,title,price,seller_id,review_status,license_personal_enabled,license_personal_price,license_commercial_enabled,license_commercial_price,license_agency_enabled,license_agency_price,license_exclusive_enabled,license_exclusive_price,delivery_tier,exclusive_sold_at,exclusive_owner_id,status")
      .eq("id", productId)
      .maybeSingle();

    if (productErr) {
      return jsonResponse({ error: "Failed to load product" }, 400);
    }
    if (!product) {
      return jsonResponse({ error: "Product not found" }, 404);
    }
    if (product.review_status !== "approved") {
      return jsonResponse({ error: "Product is not approved" }, 400);
    }

    const isExclusiveSold = !!product.exclusive_sold_at || !!product.exclusive_owner_id || product.status === "locked_exclusive";
    if (isExclusiveSold) {
      return jsonResponse({ error: "Product is already exclusively sold" }, 400);
    }

    const basePrice = resolveTierPrice(product, licenseTier);
    if (basePrice === null || Number.isNaN(basePrice)) {
      return jsonResponse({ error: "Selected license tier is not enabled" }, 400);
    }

    if (licenseTier === "exclusive" && !ipAccepted) {
      return jsonResponse({ error: "ip_assignment_accepted must be true for exclusive license" }, 400);
    }

    let finalPrice = clampNonNegative(basePrice);

    if (couponCode) {
      const { data: coupons, error: couponErr } = await supabase
        .from("dkai_coupons")
        .select("id,code,discount_type,discount_value,usage_limit,times_redeemed,expires_at,active,product_id,seller_id")
        .eq("seller_id", product.seller_id)
        .ilike("code", couponCode)
        .limit(1);

      if (!couponErr && coupons && coupons.length > 0) {
        const coupon = coupons[0];
        const now = new Date();
        const expired = coupon.expires_at ? new Date(coupon.expires_at) < now : false;
        const usageExceeded = coupon.usage_limit != null && Number(coupon.times_redeemed ?? 0) >= Number(coupon.usage_limit);
        const productMatch = !coupon.product_id || coupon.product_id === product.id;

        if (coupon.active && !expired && !usageExceeded && productMatch) {
          if (coupon.discount_type === "percent") {
            const pct = Number(coupon.discount_value);
            if (!Number.isNaN(pct) && pct > 0) {
              finalPrice = clampNonNegative(finalPrice - (finalPrice * pct / 100));
            }
          } else if (coupon.discount_type === "fixed") {
            const fixed = Number(coupon.discount_value);
            if (!Number.isNaN(fixed) && fixed > 0) {
              finalPrice = clampNonNegative(finalPrice - fixed);
            }
          }
        }
      }
    }

    finalPrice = Math.round(finalPrice * 100) / 100;

    const { data: sellerCfg, error: sellerCfgErr } = await supabase
      .from("dkai_seller_payment_configs")
      .select("paypal_merchant_id,paypal_payments_receivable,accepts_paypal")
      .eq("seller_id", product.seller_id)
      .maybeSingle();

    if (
      sellerCfgErr ||
      !sellerCfg?.paypal_merchant_id ||
      sellerCfg.paypal_payments_receivable !== true ||
      sellerCfg.accepts_paypal === false
    ) {
      return jsonResponse({ error: "Seller has not enabled PayPal" }, 400);
    }

    // Same shared fee rule as the Stripe paths: founding sellers pay 0% on
    // their own first 4 SETTLED sales, then the normal per-seller fee.
    const platformFeePercent = await getPlatformFeePercent(supabase, product.seller_id);


    const platformFee = Math.round((finalPrice * platformFeePercent / 100) * 100) / 100;
    const sellerEarnings = Math.round((finalPrice - platformFee) * 100) / 100;

    const insertPayload = {
      buyer_id: buyerId,
      product_id: product.id,
      seller_id: product.seller_id,
      price: finalPrice,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      payment_method: "paypal",
      status: "pending_payment",
      license_tier: licenseTier,
      paypal_merchant_id: sellerCfg.paypal_merchant_id,
      paypal_is_sandbox: IS_SANDBOX,
      referral_source: referralSource,
      delivery_tier: product.delivery_tier,
      currency: "chf",
    };

    const { data: order, error: orderErr } = await supabase
      .from("dkai_orders")
      .insert(insertPayload)
      .select("id")
      .single();

    if (orderErr || !order) {
      return jsonResponse({ error: "Failed to create order" }, 400);
    }

    const oauth = await getOAuthToken();
    if (!oauth.accessToken) {
      return jsonResponse(
        {
          error: "Failed to get PayPal OAuth token",
          paypal_error: oauth.error,
        },
        400,
      );
    }

    const orderId = order.id as string;
    const desc = String(product.title ?? "Product").slice(0, 127);

    const paypalBody: any = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          custom_id: orderId,
          description: desc,
          amount: {
            currency_code: "CHF",
            value: toMoney2(finalPrice),
          },
          payee: {
            merchant_id: sellerCfg.paypal_merchant_id,
          },
        },
      ],
      application_context: {
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${originUrl.origin}/checkout/paypal-return?order=${encodeURIComponent(orderId)}`,
        cancel_url: `${originUrl.origin}/checkout?productId=${encodeURIComponent(product.id)}&canceled=true`,
      },
    };

    if (platformFee > 0) {
      paypalBody.purchase_units[0].payment_instruction = {
        disbursement_mode: "INSTANT",
        platform_fees: [
          {
            amount: {
              currency_code: "CHF",
              value: toMoney2(platformFee),
            },
          },
        ],
      };
    }

    const paypalHeaders: HeadersInit = {
      Authorization: `Bearer ${oauth.accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": orderId,
    };

    if (PAYPAL_BN_CODE) {
      paypalHeaders["PayPal-Partner-Attribution-Id"] = PAYPAL_BN_CODE;
    }

    const paypalResp = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: paypalHeaders,
      body: JSON.stringify(paypalBody),
    });

    const paypalData = await paypalResp.json().catch(() => ({}));

    if (!paypalResp.ok) {
      const parsed = parsePayPalError(paypalData);
      return jsonResponse(
        {
          error: "PayPal order creation failed",
          paypal_error: parsed,
        },
        400,
      );
    }

    const paypalOrderId = paypalData?.id as string | undefined;
    if (!paypalOrderId) {
      return jsonResponse(
        {
          error: "PayPal order creation failed",
          paypal_error: parsePayPalError(paypalData),
        },
        400,
      );
    }

    const { error: updateErr } = await supabase
      .from("dkai_orders")
      .update({ paypal_order_id: paypalOrderId })
      .eq("id", orderId);

    if (updateErr) {
      return jsonResponse({ error: "Failed to save PayPal order id" }, 400);
    }

    const links = Array.isArray(paypalData?.links) ? paypalData.links : [];
    const payerAction = links.find((l: any) => l?.rel === "payer-action")?.href;
    const approve = links.find((l: any) => l?.rel === "approve")?.href;
    const approveUrl = payerAction ?? approve;

    if (!approveUrl) {
      return jsonResponse({ error: "PayPal approval URL not found" }, 400);
    }

    return jsonResponse({
      approve_url: approveUrl,
      paypal_order_id: paypalOrderId,
      order_id: orderId,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});
