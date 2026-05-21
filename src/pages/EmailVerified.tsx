import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function EmailVerified() {
  const navigate = useNavigate();
  const [name, setName] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const fullName = (user?.user_metadata?.full_name as string) || '';
      if (fullName) setName(fullName.split(' ')[0]);
    });
    const t = setTimeout(() => navigate('/marketplace', { replace: true }), 2000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-green-50">
            <CheckCircle2 size={64} className="text-green-500" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold text-gray-900 mb-3">
          Email verified!
        </h1>
        <p className="text-muted-foreground">
          Welcome to DK AI Marketplace{name ? `, ${name}` : ''}. Taking you to your account...
        </p>
      </div>
    </div>
  );
}
