import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { toast } from 'sonner';
import {
  Download, Trash2, AlertTriangle, Loader2, Eye, Mail, Cookie, FileEdit, XCircle, Shield,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Link } from 'react-router-dom';

export function PrivacyDataSettings() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [accessSummary, setAccessSummary] = useState<any>(null);
  const [pendingDeletion, setPendingDeletion] = useState<{ scheduled_deletion_at: string } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    db.from('dkai_deletion_requests')
      .select('scheduled_deletion_at,status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()
      .then(({ data }: any) => setPendingDeletion(data || null));
  }, [user]);

  const handleExport = async () => {
    setIsExporting(true);
    setDownloadUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data');
      if (error) throw error;
      setDownloadUrl(data.downloadUrl);
      toast.success('Your data export is ready. Check your email or download below.');
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const openAccessModal = async () => {
    if (!user) return;
    setShowAccessModal(true);
    const [profile, products, orders, reviews, messages] = await Promise.all([
      db.from('dkai_profiles').select('email,created_at,full_name,bio,avatar_url,cookie_preferences').eq('id', user.id).maybeSingle(),
      db.from('dkai_products').select('id', { count: 'exact', head: true }).eq('seller_id', user.id),
      db.from('dkai_orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id),
      db.from('dkai_reviews').select('id', { count: 'exact', head: true }).eq('reviewer_id', user.id),
      db.from('dkai_messages').select('id', { count: 'exact', head: true }).eq('sender_id', user.id),
    ]);
    setAccessSummary({
      account: {
        email: user.email,
        created: (profile.data as any)?.created_at,
        last_sign_in: (user as any).last_sign_in_at,
      },
      profile: {
        name: (profile.data as any)?.full_name,
        bio: (profile.data as any)?.bio,
        avatar: (profile.data as any)?.avatar_url ? 'set' : 'none',
      },
      activity: {
        products: (products as any).count || 0,
        orders: (orders as any).count || 0,
        reviews: (reviews as any).count || 0,
        messages: (messages as any).count || 0,
      },
      marketing: {
        cookie_consent: (profile.data as any)?.cookie_preferences || 'not set',
      },
      last_updated: new Date().toISOString(),
    });
  };

  const handleDelete = async () => {
    if (confirmText !== 'DELETE' || !password) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('initiate-account-deletion', {
        body: { confirmation: 'DELETE', password },
      });
      if (error) throw error;
      setPendingDeletion({ scheduled_deletion_at: data.scheduledDeletionAt });
      setShowDeleteModal(false);
      setConfirmText(''); setPassword('');
      toast.success('Account deletion scheduled. Check your email.');
    } catch (e: any) {
      toast.error(e?.message || 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-account-deletion', { body: {} });
      if (error) throw error;
      setPendingDeletion(null);
      toast.success('Account deletion cancelled.');
    } catch (e: any) {
      toast.error(e?.message || 'Cancel failed');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold mb-1 flex items-center gap-2">
          <Shield className="h-5 w-5" /> Privacy & Data
        </h2>
        <p className="text-sm text-muted-foreground">Exercise your rights under GDPR & Swiss revDSG.</p>
      </div>

      {pendingDeletion && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Deletion scheduled</CardTitle>
            <CardDescription>
              Your account will be deleted on{' '}
              <strong>{new Date(pendingDeletion.scheduled_deletion_at).toLocaleDateString('en-US')}</strong>. You can still cancel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Cancel deletion
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 1. Download */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Download className="h-5 w-5 text-primary" /> Download my data</CardTitle>
          <CardDescription>Right to data portability (GDPR Art. 20 / revDSG Art. 28). Includes profile, products, orders, messages, reviews, custom orders, and waitlist entry as a ZIP of JSON files.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleExport} disabled={isExporting} variant="outline">
            {isExporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…</> : <><Download className="mr-2 h-4 w-4" /> Download all my data</>}
          </Button>
          {downloadUrl && (
            <p className="text-sm">
              Ready: <a href={downloadUrl} className="text-primary underline" target="_blank" rel="noreferrer">Download ZIP</a> (link valid 7 days, also sent to your email).
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-5 w-5 text-primary" /> Access my data</CardTitle>
          <CardDescription>See a summary of what we store about you (GDPR Art. 15).</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showAccessModal} onOpenChange={setShowAccessModal}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={openAccessModal}><Eye className="mr-2 h-4 w-4" /> What data do you have about me?</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Data we hold about you</DialogTitle>
                <DialogDescription>Summary by category.</DialogDescription>
              </DialogHeader>
              {!accessSummary ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto">
                  {Object.entries(accessSummary).filter(([k]) => k !== 'last_updated').map(([cat, v]) => (
                    <div key={cat}>
                      <h4 className="font-semibold capitalize mb-1">{cat}</h4>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{JSON.stringify(v, null, 2)}</pre>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Last updated: {new Date(accessSummary.last_updated).toLocaleString()}</p>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* 4. Update */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileEdit className="h-5 w-5 text-primary" /> Update or correct my data</CardTitle>
          <CardDescription>You have the right to correct inaccurate data (GDPR Art. 16). Update here or contact dari@dkaisystem.com.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline"><Link to="/profile">Edit my profile</Link></Button>
        </CardContent>
      </Card>

      {/* 5. Withdraw consent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Cookie className="h-5 w-5 text-primary" /> Withdraw consent</CardTitle>
          <CardDescription>Manage cookie and communication preferences (GDPR Art. 7(3)).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/cookie-settings">Cookie preferences</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/settings?tab=privacy">Email preferences</Link></Button>
          <span className="text-xs text-muted-foreground self-center">To withdraw all data-processing consent, delete your account below.</span>
        </CardContent>
      </Card>

      {/* 6. Contact DPO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-5 w-5 text-primary" /> Contact data protection</CardTitle>
          <CardDescription>For any privacy question. Response within 30 days (GDPR/revDSG).</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="mailto:dari@dkaisystem.com?subject=Data%20Protection%20Request">
              <Mail className="mr-2 h-4 w-4" /> Email data protection
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* 2. Delete */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive"><Trash2 className="h-5 w-5" /> Delete my account</CardTitle>
          <CardDescription>Right to erasure (GDPR Art. 17 / revDSG).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-destructive/40 bg-destructive/5 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              This is permanent. Your profile, products, reviews, and history will be removed within 30 days.
              Transactional records are kept anonymized for legal compliance (10-year retention — Swiss accounting law).
            </p>
          </div>

          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={!!pendingDeletion}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete my account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm account deletion</DialogTitle>
                <DialogDescription>
                  Type <span className="font-mono font-bold">DELETE</span> and re-enter your password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="confirm">Type DELETE</Label>
                  <Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
                </div>
                <div>
                  <Label htmlFor="pwd">Password</Label>
                  <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={confirmText !== 'DELETE' || !password || isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Yes, delete forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
