/**
 * Frontend mirror of the server-side sales switch
 * (`supabase/functions/_shared/sales-mode.ts`).
 *
 * This constant only hides purchase UI. The authoritative block lives in the
 * edge functions and cannot be bypassed by any client parameter.
 */
export const SALES_ENABLED = false;
