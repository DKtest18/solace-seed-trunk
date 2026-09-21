// DEPRECATED AND DISABLED.
//
// This function used to sign every delivery file of a product with no scan-status
// check, no rate limit, no audit log and no verification that the stored path
// belongs to the product's seller. All buyer downloads now go through
// `generate-download-url`, admin access through `admin-download-product-file`.
//
// It is kept only so that redeploying replaces the old, permissive version.
// Delete the deployed copy in the Supabase dashboard (Edge Functions) as well.
import { handleCors, errorResponse } from '../_shared/cors.ts';

Deno.serve((req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  return errorResponse('This endpoint has been retired. Use generate-download-url.', 410);
});
