import { supabase } from '@/integrations/supabase/client';

type PublicFunctionClient = {
  supabaseUrl: string;
  supabaseKey: string;
};

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    const value = body.error ?? body.message ?? body.details;
    if (typeof value === 'string' && value.trim()) return value;
    if (value && typeof value === 'object') return JSON.stringify(value);
  }
  return fallback;
}

/**
 * Calls a public Edge Function for signed-out visitors. The Supabase gateway
 * rejects requests without an Authorization header, so we send the publishable
 * anon key. The function must treat an anon-key token as a guest (no user).
 */
export async function invokePublicFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const client = supabase as unknown as PublicFunctionClient;
  const response = await fetch(`${client.supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: client.supabaseKey,
      Authorization: `Bearer ${client.supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });


  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(errorMessage(payload, `Checkout request failed (${response.status})`));
  }

  return payload as T;
}