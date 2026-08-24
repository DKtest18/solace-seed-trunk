import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { File as FileIcon, Download, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BuyerFile {
  id: string;
  original_filename: string;
  file_size: number;
  scan_status: string;
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function BuyerProductDownloads({ productId }: { productId: string }) {
  const [files, setFiles] = useState<BuyerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke('generate-download-url', {
        body: { action: 'list', product_id: productId },
      });
      if (error || (data as any)?.error) {
        toast({
          title: 'Could not load delivery files',
          description: (data as any)?.error || error?.message,
          variant: 'destructive',
        });
      }
      setFiles(((data as any)?.files as BuyerFile[]) ?? []);
      setLoading(false);
    })();
  }, [productId, toast]);

  const handleDownload = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-download-url', {
        body: { product_file_id: id },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || 'Failed');
      }
      window.open((data as any).signed_url, '_blank');
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Your files</h3>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Download links expire after 1 hour. You can regenerate one anytime by clicking Download again.
        </AlertDescription>
      </Alert>
      <div className="space-y-2">
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
            <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.original_filename}</p>
              <p className="text-xs text-muted-foreground">{formatSize(f.file_size)}</p>
            </div>
            <Button size="sm" onClick={() => handleDownload(f.id)} disabled={busyId === f.id}>
              {busyId === f.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Download
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
