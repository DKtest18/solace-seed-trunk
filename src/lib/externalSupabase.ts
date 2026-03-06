import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://dwqpkdatzdqhplgyhigg.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3cXBrZGF0emRxaHBsZ3loaWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU5MzIsImV4cCI6MjA2NzkyMTkzMn0.yxyN30pp3ZuX8gxcib6DMdpf_8SIiGI_ag5Pcjo8lbA';

export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
