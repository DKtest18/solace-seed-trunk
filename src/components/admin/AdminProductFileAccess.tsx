import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { File as FileIcon, ShieldAlert, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminFile {
  id: string;
  file_name: string;
  file_size: number;
  scan_status: string;
}

function formatSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function AdminProductFileAccess({
  productId,
  disputeId,
  mode = 'dispute',
}: {
  productId: string;
  disputeId?: string;
  mode?: 'dispute' | 'review';
}) {
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminFile | null>(null);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('dkai_product_files')
        .select('id, file_name, file_size, scan_status')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      setFiles((data as AdminFile[]) ?? []);
      setLoading(false);
    })();
  }, [productId]);

  const submit = async () => {
    if (!selected) return;
    if (justification.trim().length < 20) {
      toast({ title: 'Justification required', description: 'Please provide at least 20 characters explaining why you need access.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-access-file', {
        body: {
          product_file_id: selected.id,
          justification: justification.trim(),
          dispute_id: disputeId ?? null,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || 'Access denied');
      }
      window.open((data as any).signed_url, '_blank');
      toast({ title: 'Access granted', description: 'Link valid for 15 minutes. This access has been logged.' });
      setSelected(null);
      setJustification('');
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (files.length === 0) return null;

  const isReview = mode === 'review';

  return (
    <Card className={isReview ? 'border-primary/40' : 'border-destructive/40'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className={isReview ? 'w-5 h-5 text-primary' : 'w-5 h-5 text-destructive'} />
          {isReview ? 'Admin file access (product review)' : 'Admin file access (dispute use only)'}
        </CardTitle>
        <CardDescription>
          {isReview
            ? 'Download the files the seller uploaded for this product. Every access is audit-logged.'
            : 'Every access is audit-logged and visible to the seller. Use only when strictly required for dispute resolution.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Alert variant={isReview ? 'default' : 'destructive'}>
          <AlertDescription className="text-sm">
            {isReview
              ? 'Provide a short reason for the download. Links expire after 15 minutes and every access is logged.'
              : 'You must provide a justification (≥20 chars). Links expire after 15 minutes.'}
          </AlertDescription>
        </Alert>
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.file_name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(f.file_size)} · scan: {f.scan_status}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelected(f)}>
              <ExternalLink className="w-4 h-4 mr-2" /> {isReview ? 'Download file' : 'Request access'}
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isReview ? 'Confirm file download' : 'Justify file access'}</DialogTitle>
            <DialogDescription>
              {isReview
                ? <>You are about to download <strong>{selected?.file_name}</strong>. This action will be logged with your admin account.</>
                : <>Accessing <strong>{selected?.file_name}</strong>. The seller will be notified by email and this action will be logged with your account.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="justification">Reason for access</Label>
            <Textarea
              id="justification"
              rows={5}
              placeholder={isReview ? "Short reason for downloading this file during product review (min. 20 characters)…" : "Explain why this access is necessary for dispute resolution (min. 20 characters)…"}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{justification.trim().length} / 20 characters minimum</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || justification.trim().length < 20}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm & open file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
