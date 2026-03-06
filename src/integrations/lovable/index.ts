// Lovable Cloud auth removed - using external Supabase directly
import { supabase } from "../supabase/client";

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple", opts?: any) => {
      // Redirect to Supabase OAuth directly
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri || window.location.origin,
        },
      });
      if (error) return { error };
      return { redirected: true };
    },
  },
};
