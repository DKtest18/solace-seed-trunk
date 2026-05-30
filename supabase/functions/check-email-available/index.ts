import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory rate limiter (per-instance). 10 requests / 60s / IP.
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const start = Date.now();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const finish = async (body: unknown, status = 200) => {
    // Normalize response time to ~200ms to mitigate timing-based enumeration
    const elapsed = Date.now() - start;
    if (elapsed < 200) await delay(200 - elapsed);
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  if (isRateLimited(ip)) {
    console.warn(`[check-email-available] rate limited ip=${ip}`);
    return finish(
      { available: false, reason: "Too many requests. Please try again later." },
      429,
    );
  }

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return finish({ available: false, reason: "Please use a different email" });
  }

  if (!email || !emailRegex.test(email) || email.length > 255) {
    return finish({ available: false, reason: "Please use a different email" });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check dkai_profiles (case-insensitive)
    const { data: profileMatch, error: profileErr } = await admin
      .from("dkai_profiles")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (profileErr) {
      console.error("[check-email-available] profile query error", profileErr);
    }

    if (profileMatch) {
      return finish({ available: false, reason: "Please use a different email" });
    }

    // Also check auth.users via admin API as source of truth
    const { data: usersPage, error: usersErr } =
      await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (usersErr) {
      console.error("[check-email-available] listUsers error", usersErr);
      return finish({ available: true });
    }

    const taken = usersPage.users.some(
      (u) => (u.email ?? "").toLowerCase() === email,
    );

    if (taken) {
      return finish({ available: false, reason: "Please use a different email" });
    }

    return finish({ available: true });
  } catch (err) {
    console.error("[check-email-available] unexpected error", err);
    return finish({ available: true });
  }
});
