import { useEffect, useState } from 'react';
import { Linkedin, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Account settings card: link a LinkedIn account (email signups) or show the
 * connected state for users who already signed in with LinkedIn.
 */
export function LinkedInConnectCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const hasLinkedInIdentity = !!user?.identities?.some((i) => i.provider === 'linkedin_oidc');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await db
        .from('dkai_profiles')
        .select('is_linkedin_verified, linkedin_url')
        .eq('id', user.id)
        .maybeSingle();
      setVerified(!!data?.is_linkedin_verified || hasLinkedInIdentity);
      setLinkedinUrl(data?.linkedin_url || '');
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleLink = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${window.location.origin}/profile/settings`,
          scopes: 'openid profile email',
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err?.message || 'Could not start LinkedIn linking.');
      setBusy(false);
    }
  };

  const saveUrl = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await db
      .from('dkai_profiles')
      .update({ linkedin_url: linkedinUrl.trim() || null })
      .eq('id', user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success('LinkedIn profile URL saved.');
  };

  return (
    <Card className="bg-white border border-border rounded-xl p-6 shadow-none">
      <CardHeader className="p-0 mb-6">
        <CardTitle className="font-display text-xl font-semibold mb-1 flex items-center gap-2">
          <Linkedin className="h-5 w-5 text-[#0A66C2]" />
          LinkedIn
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Connect LinkedIn to show a verified identity badge on your public profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : verified ? (
          <div className="flex items-center gap-3 p-4 border border-green-200 rounded-lg bg-green-50">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="font-medium text-green-800">LinkedIn Connected</p>
              <p className="text-sm text-green-700">
                Your profile shows the “Verified via LinkedIn” badge.
              </p>
            </div>
          </div>
        ) : (
          <Button onClick={handleLink} disabled={busy} variant="outline">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Linkedin className="h-4 w-4 mr-2 text-[#0A66C2]" />}
            Link LinkedIn Account
          </Button>
        )}

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">LinkedIn profile URL</Label>
          <div className="flex gap-2">
            <Input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/your-handle"
            />
            <Button onClick={saveUrl} disabled={busy} variant="outline">
              Save
            </Button>
          </div>
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Open profile <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
