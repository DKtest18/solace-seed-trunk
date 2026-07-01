import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import dkLogo from '@/assets/dk-ai-logo.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-soft to-background-soft items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="inline-flex bg-gray-900 rounded-lg p-1 px-2 mb-8">
            <img src={dkLogo} alt="DK AI Marketplace" className="h-12 w-auto" />
          </div>
          <h2 className="text-3xl font-display font-semibold text-gray-900 mb-3">Reset your password.</h2>
          <p className="accent-serif text-gray-600">We'll email you a secure link.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-display font-semibold text-gray-900 mb-1">Forgot password</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Enter your account email and we'll send you a reset link.
          </p>

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-primary-soft/40 p-4 text-sm text-gray-900">
                If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox.
              </div>
              <Link to="/login" className="text-sm text-primary hover:underline">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-gray-900 mb-1.5 block">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <Button type="submit" variant="hero" className="w-full mt-6" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-6">
                Remembered it?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
