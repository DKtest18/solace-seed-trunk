import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, File as FileIcon, Trash2, Loader2, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadDeliveryFile, deleteDeliveryFile, resubmitProductForReview } from '@/lib/deliveryFileUpload';

interface ProductFile {
  id: string;
  file_name: string;
  file_size: number;
  file_path: string;
  mime_type: string;
  scan_status: 'pending' | 'clean' | 'infected' | 'failed';
  created_at: string;
}

const MAX_SIZE = 2 * 1024 * 1024 * 1024;

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 120);
}

export function ProductDeliveryFilesManager({
  productId,
  reviewStatus,
  onResubmitted,
}: {
  productId: string;
  reviewStatus?: string | null;
  onResubmitted?: () => void;
}) {
  const [files, setFiles] = useState<ProductFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('dkai_product_files')
      .select('id, file_name, file_size, file_path, mime_type, scan_status, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (!error) setFiles((data as ProductFile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  // Poll while any file is still scanning
  useEffect(() => {
    if (!files.some(f => f.scan_status === 'pending')) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [files]);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast({ title: 'File too large', description: 'Max 500 MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      await uploadDeliveryFile(productId, file);
      setDirty(true);
      toast({ title: 'Uploaded and saved', description: file.name });
      await load();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleResubmit = async () => {
    setResubmitting(true);
    try {
      await resubmitProductForReview(productId);
      setDirty(false);
      toast({ title: 'Sent for review', description: 'Your updated files were submitted to the review team.' });
      onResubmitted?.();
    } catch (err: any) {
      toast({ title: 'Resubmission failed', description: err.message, variant: 'destructive' });
    } finally {
      setResubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this file? Buyers will no longer be able to download it.')) return;
    try {
      await deleteDeliveryFile(productId, id);
      setDirty(true);
      toast({ title: 'File deleted' });
      load();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const totalSize = files.reduce((s, f) => s + f.file_size, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Delivery Files</h3>
          <p className="text-sm text-muted-foreground">
            {files.length} file{files.length === 1 ? '' : 's'} · {formatSize(totalSize)}
          </p>
        </div>
        <div>
          <input id="dk-upload" type="file" className="hidden" onChange={handleSelect} disabled={uploading} />
          <Button onClick={() => document.getElementById('dk-upload')?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? 'Uploading…' : 'Upload file'}
          </Button>
        </div>
      </div>

      {!!reviewStatus && reviewStatus !== 'draft' && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            You can add or replace delivery files after submission. Send the product back to review
            so our team checks the new files.
          </p>
          <Button onClick={handleResubmit} disabled={resubmitting || uploading || files.length === 0}>
            {resubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {dirty ? 'Save & resend for review' : 'Resend for review'}
          </Button>
        </div>
      )}

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Files are private, virus-scanned, and only accessible to verified buyers via short-lived signed links.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : files.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">
          No delivery files yet.
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(f.file_size)} · {new Date(f.created_at).toLocaleString()}</p>
              </div>
              {f.scan_status === 'pending' && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                  <Loader2 className="w-3 h-3 animate-spin mr-1" /> Scanning…
                </Badge>
              )}
              {f.scan_status === 'clean' && (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" /> Safe</Badge>
              )}
              {(f.scan_status === 'infected' || f.scan_status === 'failed') && (
                <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Issue detected</Badge>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
