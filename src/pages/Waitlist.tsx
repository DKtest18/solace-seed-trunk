import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Hourglass, AlertCircle } from 'lucide-react';
import { db } from '@/lib/dkaiDb';

export default function Waitlist() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState<string>('');

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    const metaName =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      '';
    setFirstName(metaName.split(' ')[0] || '');

    db.from('dkai_waitlist')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.full_name) setFirstName(String(data.full_name).split(' ')[0]);
      });
  }, [user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-lg w-full mx-auto text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft mb-8">
          <Hourglass className="h-12 w-12 text-primary" />
        </div>

        <h1 className="font-display text-3xl font-semibold text-gray-900 mb-3">
          You're on the waitlist.
        </h1>

        <p className="text-gray-700 mb-6">
          {firstName ? `Thanks for joining, ${firstName}.` : 'Thanks for joining.'}
        </p>

        <p className="text-muted mb-8">
          We're reviewing applications in the order we receive them. You'll get
          an email as soon as you're approved.
        </p>

        <p className="accent-serif text-gray-500 italic mb-10">
          Made by AI, made for AI. — DK
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <a
              href="https://www.linkedin.com/company/dk-ai-marketplace"
              target="_blank"
              rel="noopener noreferrer"
            >
              Follow on LinkedIn
            </a>
          </Button>
          <Button variant="ghost" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        <div className="mt-10 text-sm text-muted">
          <Link to="/" className="hover:underline">
            ← Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
