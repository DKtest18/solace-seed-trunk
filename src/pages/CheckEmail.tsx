import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const WEBMAIL: Record<string, { label: string; url: string }> = {
  'gmail.com': { label: 'Open Gmail', url: 'https://mail.google.com' },
  'googlemail.com': { label: 'Open Gmail', url: 'https://mail.google.com' },
  'outlook.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail' },
  'hotmail.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail' },
  'live.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail' },
  'yahoo.com': { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com' },
  'icloud.com': { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' },
  'me.com': { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' },
  'proton.me': { label: 'Open Proton Mail', url: 'https://mail.proton.me' },
  'protonmail.com': { label: 'Open Proton Mail', url: 'https://mail.proton.me' },
};

export default function CheckEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const domain = email.split('@')[1]?.toLowerCase();
  const webmail = domain ? WEBMAIL[domain] : null;

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      toast.success('Verification email resent — check your inbox and spam folder');
      setCooldown(60);
    } catch (e: any) {
      toast.error(e.message || 'Failed to resend email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-primary/10">
            <MailCheck size={64} className="text-primary" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold text-gray-900 mb-3">
          Check your email
        </h1>
        <p className="text-muted-foreground mb-4">
          We sent a verification link to your inbox. Click the link to activate your account.
        </p>
        {email && (
          <div className="flex justify-center mb-6">
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium text-sm">
              {email}
            </span>
          </div>
        )}
        <p className="text-sm text-muted-foreground mb-8">
          Don't see it? Check your spam folder or wait a minute — emails usually arrive within 30 seconds.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={cooldown > 0 || resending || !email}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s...` : resending ? 'Sending...' : 'Resend verification email'}
          </Button>
          {webmail && (
            <Button variant="ghost" asChild>
              <a href={webmail.url} target="_blank" rel="noopener noreferrer">
                {webmail.label}
              </a>
            </Button>
          )}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Wrong email?{' '}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            Sign up again
          </Link>
        </p>
      </div>
    </div>
  );
}
