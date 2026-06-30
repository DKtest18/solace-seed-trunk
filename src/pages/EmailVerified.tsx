import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export default function EmailVerified() {
  const [name, setName] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const fullName = (user?.user_metadata?.full_name as string) || '';
      if (fullName) setName(fullName.split(' ')[0]);
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-green-50">
            <CheckCircle2 size={64} className="text-green-500" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-3">
          Email verified{name ? `, ${name}` : ''}
        </h1>
        <p className="text-muted-foreground mb-8">
          Your email has been verified. You're all set to continue.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/marketplace">Go to Marketplace</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
