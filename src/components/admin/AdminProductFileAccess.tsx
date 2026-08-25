import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { File as FileIcon, ShieldAlert, Loader2, ExternalLink, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadUrl } from '@/lib/downloadFile';

interface AdminFile {
  id: string;
  original_filename: string;
  file_size: number;
  scan_status: string;
}

interface SignedFile {
  id: string;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  signed_url: string;
  expires_in?: number;
}

function formatSize(b?: number | null) {
  if (!b || b < 0) return 'unknown size';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: 'Your session expired. Sign in again and retry.',
  not_admin: 'Your account does not have admin rights for delivery-file access.',
  reason_too_short: 'The reason must be at least 20 characters.',
  missing_product_id: 'No product was provided for this download.',
  invalid_json: 'The request could not be read by the server.',
  no_files_for_product: 'There are no delivery files for this product.',
  signed_url_failed: 'The storage signed URL could not be created. Try again in a moment.',
  internal_error: 'The download service hit an unexpected error.',
};

/** Reads the real JSON body out of a FunctionsHttpError instead of the wrapper message. */
async function describeInvokeError(error: any): Promise<{ code?: string; message: string; raw: string }> {
  let raw = '';
  let code: string | undefined;
  try {
    const body = await error?.context?.json?.();
    if (body) {
      raw = JSON.stringify(body);
      code = body.error || body.code;
    }
  } catch {
    try {
      raw = (await error?.context?.text?.()) ?? '';
    } catch {
      raw = '';
    }
  }
  if (!raw) raw = error?.message ?? 'unknown error';
  const message = (code && ERROR_MESSAGES[code]) || raw;
  return { code, message, raw };
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<AdminFile | null>(null);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [signed, setSigned] = useState<SignedFile[]>([]);
  const [signedAt, setSignedAt] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from('dkai_product_files')
        .select('id, original_filename, file_size, scan_status')
        .eq('product_id', productId)
        .order('uploaded_at', { ascending: false });
      if (error) setLoadError(error.message);
      setFiles((data as AdminFile[]) ?? []);
      setLoading(false);
    })();
  }, [productId]);

  const openDialog = (file: AdminFile | null) => {
    setSelected(file);
    setErrorDetails(null);
    setSigned([]);
    setSignedAt(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelected(null);
    setJustification('');
    setErrorDetails(null);
    setSigned([]);
    setSignedAt(null);
  };

  /** Calls the edge function; returns fresh signed files or null on failure. */
  const requestSignedFiles = async (fileId: string | null, reasonText: string): Promise<SignedFile[] | null> => {
    const { data, error } = await supabase.functions.invoke('admin-download-product-file', {
      body: {
        product_id: productId,
        ...(fileId ? { file_id: fileId } : {}),
        reason: reasonText,
        ...(disputeId ? { dispute_id: disputeId } : {}),
      },
    });

    if (error) {
      const info = await describeInvokeError(error);
      console.error('admin-download-product-file failed:', info.raw, error);
      const details = `${info.message}\n\nRaw response: ${info.raw}`;
      setErrorDetails(details);
      toast({ title: 'Download failed', description: info.message, variant: 'destructive' });
      return null;
    }

    const payload = data as any;
    if (payload?.error) {
      const raw = JSON.stringify(payload);
      console.error('admin-download-product-file failed:', raw);
      setErrorDetails(`${ERROR_MESSAGES[payload.error] ?? payload.error}\n\nRaw response: ${raw}`);
      return null;
    }

    const list: SignedFile[] = Array.isArray(payload?.files) ? payload.files : [];
    if (list.length === 0) {
      const raw = JSON.stringify(payload ?? {});
      setErrorDetails(`${ERROR_MESSAGES.no_files_for_product}\n\nRaw response: ${raw}`);
      return null;
    }
    return list;
  };

  const submit = async () => {
    const reasonText = justification.trim();
    if (reasonText.length < 20) {
      toast({ title: 'Reason required', description: 'Please provide at least 20 characters.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setErrorDetails(null);
    try {
      const list = await requestSignedFiles(selected?.id ?? null, reasonText);
      if (!list) return;

      if (list.length === 1) {
        await downloadUrl(list[0].signed_url, list[0].file_name);
        toast({ title: 'Download started', description: 'This access has been logged.' });
        closeDialog();
        return;
      }

      setSigned(list);
      setSignedAt(Date.now());
      toast({ title: `${list.length} files ready`, description: 'Links expire after 5 minutes.' });
    } finally {
      setBusy(false);
    }
  };

  const refreshLinks = async () => {
    setBusy(true);
    try {
      const list = await requestSignedFiles(selected?.id ?? null, justification.trim());
      if (list) {
        setSigned(list);
        setSignedAt(Date.now());
      }
    } finally {
      setBusy(false);
    }
  };

  const stale = signedAt !== null && Date.now() - signedAt > 280_000;

  const downloadOne = async (f: SignedFile) => {
    if (stale) {
      toast({ title: 'Links expired', description: 'Request fresh links first.', variant: 'destructive' });
      return;
    }
    await downloadUrl(f.signed_url, f.file_name);
  };

  const downloadAll = async () => {
    if (stale) {
      toast({ title: 'Links expired', description: 'Request fresh links first.', variant: 'destructive' });
      return;
    }
    for (const f of signed) {
      await downloadUrl(f.signed_url, f.file_name);
      await new Promise((r) => setTimeout(r, 400));
    }
    toast({ title: 'Downloads started', description: 'This access has been logged.' });
    closeDialog();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="text-sm">Could not load delivery files: {loadError}</AlertDescription>
      </Alert>
    );
  }
  if (files.length === 0) {
    if (mode !== 'review') return null;
    return (
      <Alert>
        <AlertDescription className="text-sm">
          There are no delivery files for this product — the seller has not uploaded any yet.
        </AlertDescription>
      </Alert>
    );
  }

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
            Provide a reason (min. 20 characters). Signed links expire after 5 minutes and every access is logged.
          </AlertDescription>
        </Alert>
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.original_filename}</p>
              <p className="text-xs text-muted-foreground">{formatSize(f.file_size)} · scan: {f.scan_status}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => openDialog(f)}>
              <ExternalLink className="w-4 h-4 mr-2" /> {isReview ? 'Download file' : 'Request access'}
            </Button>
          </div>
        ))}
        {files.length > 1 && (
          <Button size="sm" variant="secondary" onClick={() => openDialog(null)}>
            <Download className="w-4 h-4 mr-2" /> Download all files
          </Button>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isReview ? 'Confirm file download' : 'Justify file access'}</DialogTitle>
            <DialogDescription>
              {selected
                ? <>You are about to download <strong>{selected.original_filename}</strong>. This action will be logged with your admin account.</>
                : <>You are about to download <strong>all delivery files</strong> of this product. This action will be logged with your admin account.</>}
            </DialogDescription>
          </DialogHeader>

          {signed.length === 0 ? (
            <div className="space-y-2">
              <Label htmlFor="justification">Reason for access</Label>
              <Textarea
                id="justification"
                rows={5}
                placeholder="Reason for downloading these files (min. 20 characters)…"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{justification.trim().length} / 20 characters minimum</p>
            </div>
          ) : (
            <div className="space-y-2">
              {signed.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileIcon className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(f.size_bytes)}{f.mime_type ? ` · ${f.mime_type}` : ''}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => downloadOne(f)}>Download</Button>
                </div>
              ))}
              {stale && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">These links have expired. Request fresh links.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {errorDetails && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs whitespace-pre-wrap break-all">{errorDetails}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>Cancel</Button>
            {signed.length > 0 && (
              <Button variant="secondary" onClick={refreshLinks} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Request fresh links
              </Button>
            )}
            {signed.length > 0 ? (
              <Button onClick={downloadAll} disabled={busy || stale}>
                <Download className="w-4 h-4 mr-2" /> Download all
              </Button>
            ) : (
              <Button onClick={submit} disabled={busy || justification.trim().length < 20}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm &amp; download
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
