import { useState } from 'react';
import { Linkedin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  label?: string;
  redirectPath?: string;
  className?: string;
}

/**
 * Continue with LinkedIn — Supabase Auth OIDC provider (`linkedin_oidc`).
 * Used on the login and signup pages.
 */
export function LinkedInAuthButton({
  label = 'Continue with LinkedIn',
  redirectPath = '/',
  className = '',
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${window.location.origin}${redirectPath}`,
          scopes: 'openid profile email',
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err?.message || 'LinkedIn sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={label}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-background-soft disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Linkedin className="h-4 w-4 text-[#0A66C2]" />
      )}
      {label}
    </button>
  );
}
