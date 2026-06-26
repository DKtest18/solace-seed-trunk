// supabase/functions/stripe-create-price/index.ts
// Creates a Stripe Product + Price on the seller's connected account
// mirroring the product-creation Pricing step (one_time OR recurring with
// interval + interval_count). Caller is verified via JWT; we look up the
// seller's stripe_account_id ourselves and only operate on that account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function stripeForm(
  path: string,
  body: Record<string, string>,
  stripeAccount?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe ${path} failed`);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const {
      product_id,
      title,
      description,
      price,
      currency = "usd",
      pricing_model = "one_time",
      billing_interval,
      billing_interval_count = 1,
    } = body as Record<string, any>;

    if (!product_id || !title || price === undefined || price === null) {
      return new Response(
        JSON.stringify({ error: "product_id, title, price required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const amount = Math.round(parseFloat(String(price)) * 100);
    if (!Number.isFinite(amount) || amount < 50) {
      return new Response(
        JSON.stringify({ error: "Price must be >= 0.50" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Look up seller's connected account
    const { data: profile, error: profErr } = await admin
      .from("dkai_profiles")
      .select("stripe_account_id")
      .eq("id", userId)
      .maybeSingle();
    if (profErr) throw profErr;
    const stripeAccount = profile?.stripe_account_id;
    if (!stripeAccount) {
      return new Response(
        JSON.stringify({ error: "Seller has no connected Stripe account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify the product belongs to this seller
    const { data: product, error: pErr } = await admin
      .from("dkai_products")
      .select("id, seller_id, stripe_product_id, stripe_price_id")
      .eq("id", product_id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!product || product.seller_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or reuse Stripe Product
    let stripeProductId = product.stripe_product_id as string | null;
    if (!stripeProductId) {
      const sp = await stripeForm(
        "products",
        {
          name: String(title).slice(0, 250),
          ...(description ? { description: String(description).slice(0, 500) } : {}),
          "metadata[dkai_product_id]": product_id,
          "metadata[dkai_seller_id]": userId,
        },
        stripeAccount,
      );
      stripeProductId = sp.id;
    }

    // Build Price params
    const priceParams: Record<string, string> = {
      product: stripeProductId!,
      currency: String(currency).toLowerCase(),
      unit_amount: String(amount),
    };
    if (pricing_model === "recurring") {
      const interval = String(billing_interval || "month");
      const count = Math.max(1, Math.min(12, Number(billing_interval_count) || 1));
      priceParams["recurring[interval]"] = interval;
      priceParams["recurring[interval_count]"] = String(count);
    }

    const stripePrice = await stripeForm("prices", priceParams, stripeAccount);

    // If a previous price exists, deactivate it (Stripe disallows updating amount)
    if (product.stripe_price_id && product.stripe_price_id !== stripePrice.id) {
      try {
        await stripeForm(
          `prices/${product.stripe_price_id}`,
          { active: "false" },
          stripeAccount,
        );
      } catch (_) {
        // non-fatal
      }
    }

    await admin
      .from("dkai_products")
      .update({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePrice.id,
      })
      .eq("id", product_id);

    return new Response(
      JSON.stringify({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePrice.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("stripe-create-price error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
