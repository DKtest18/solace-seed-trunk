import { useState } from 'react';
import { Github, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { LinkedInAuthButton } from '@/components/auth/LinkedInAuthButton';

type OAuthProvider = 'google' | 'github';

function GoogleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.44a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.08 3.61-5.15 3.61-8.79Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.86-3a7.2 7.2 0 0 1-4.09 1.16 7.55 7.55 0 0 1-7.09-5.2H.94v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M4.91 14.05a7.2 7.2 0 0 1 0-4.6V6.36H.94a12 12 0 0 0 0 11.28l3.97-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.5 11.5 0 0 0 12 0 12 12 0 0 0 .94 6.36l3.97 3.09A7.55 7.55 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

const BUTTON_CLASS =
  'w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-background-soft disabled:opacity-60';

interface Props {
  /** Same value LinkedIn uses — path appended to window.location.origin. */
  redirectPath?: string;
  className?: string;
}

/**
 * Social sign-in block: LinkedIn (existing button, untouched) + Google + GitHub.
 * Each provider has its own loading state and surfaces the real provider error.
 */
export function OAuthProviderButtons({ redirectPath = '/', className = '' }: Props) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: OAuthProvider) => {
    setPending(provider);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}${redirectPath}` },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || t('auth.oauthFailed'));
      setPending(null);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <LinkedInAuthButton label={t('auth.continueWithLinkedIn')} redirectPath={redirectPath} />

      <button
        type="button"
        onClick={() => signIn('google')}
        disabled={pending !== null}
        aria-label={t('auth.continueWithGoogle')}
        className={BUTTON_CLASS}
      >
        {pending === 'google' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        {t('auth.continueWithGoogle')}
      </button>

      <button
        type="button"
        onClick={() => signIn('github')}
        disabled={pending !== null}
        aria-label={t('auth.continueWithGithub')}
        className={BUTTON_CLASS}
      >
        {pending === 'github' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Github className="h-4 w-4 text-gray-900" />
        )}
        {t('auth.continueWithGithub')}
      </button>

      {error && (
        <p className="text-sm text-destructive text-center" role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </div>
  );
}
