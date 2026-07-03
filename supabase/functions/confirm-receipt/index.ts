// DEPRECATED (Path A retirement, no-escrow model).
// This endpoint has been intentionally retired. Kept as a 410 stub so any
// stale client callers get a clear signal instead of a 404.
import { handleCors, corsHeaders } from '../_shared/cors.ts';

Deno.serve((req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  return new Response(
    JSON.stringify({ error: 'confirm_receipt_retired', message: 'This endpoint has been retired.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
