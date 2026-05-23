import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail, Sparkles } from 'lucide-react';
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
      <div className="w-full max-w-lg text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-green-50">
            <CheckCircle2 size={64} className="text-green-500" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-3">
          You're on the list{name ? `, ${name}` : ''}!
        </h1>
        <p className="text-muted-foreground mb-8">
          Your email has been successfully verified. Welcome to the DK AI Marketplace waitlist.
        </p>

        <div className="rounded-2xl border bg-card p-6 text-left space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">We'll email you when we launch</p>
              <p className="text-sm text-muted-foreground">
                As soon as the marketplace opens to waitlist members, you'll receive an invitation
                to your inbox with early access.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Priority access</p>
              <p className="text-sm text-muted-foreground">
                Waitlist members get in before the public launch — keep an eye on your inbox.
              </p>
            </div>
          </div>
        </div>

        <Button asChild variant="outline">
          <Link to="/">Back to homepage</Link>
        </Button>
      </div>
    </div>
  );
}
