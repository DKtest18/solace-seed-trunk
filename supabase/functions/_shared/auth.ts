import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'No authorization header' };
  }

  const supabase = getSupabaseClient(authHeader);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Invalid token' };
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? '',
      role: user.role ?? 'authenticated',
    },
    error: null,
    supabase,
    authHeader,
  };
}
