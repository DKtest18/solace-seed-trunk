import { supabase } from '@/integrations/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

// Re-export supabase client without strict Database typing
// for dkai_ prefixed tables that aren't in the auto-generated types.ts
export const db: SupabaseClient = supabase as any;
