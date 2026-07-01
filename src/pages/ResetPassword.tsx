import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import dkLogo from '@/assets/dk-ai-logo.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');

  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors';

  useEffect(() => {
    // Supabase places a recovery session either in the URL hash (#access_token=...&type=recovery)
    // or already exchanges it via detectSessionInUrl. We wait briefly, then check.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady('ok');
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady('ok');
      else {
        // give the SDK a tick to parse the hash
        setTimeout(async () => {
          const { data: d2 } = await supabase.auth.getSession();
          setReady(d2.session ? 'ok' : 'invalid');
        }, 400);
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters.');
    if (password !== confirm) return toast.error('Passwords do not match.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated. Please sign in.');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
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
          <h2 className="text-3xl font-display font-semibold text-gray-900 mb-3">Set a new password.</h2>
          <p className="accent-serif text-gray-600">Choose something you'll remember.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-display font-semibold text-gray-900 mb-1">Reset password</h1>
          <p className="text-sm text-muted-foreground mb-8">Enter and confirm your new password.</p>

          {ready === 'checking' && (
            <p className="text-sm text-muted-foreground">Verifying reset link…</p>
          )}

          {ready === 'invalid' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-gray-900">
                This reset link is invalid or has expired.
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Request a new link
              </Link>
            </div>
          )}

          {ready === 'ok' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-900 mb-1.5 block">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900 mb-1.5 block">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
              <Button type="submit" variant="hero" className="w-full mt-6" disabled={loading}>
                {loading ? 'Updating...' : 'Update password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
