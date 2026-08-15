import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Linkedin, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { parseLinkedInExport, LinkedInImportResult } from '@/lib/linkedinImport';

interface LinkedInImportCardProps {
  onImported: (result: LinkedInImportResult) => void;
}

export function LinkedInImportCard({ onImported }: LinkedInImportCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File is too large (max 50MB).');
      return;
    }
    setLoading(true);
    try {
      const result = await parseLinkedInExport(file);
      const total =
        result.experience.length + result.education.length + result.skills.length;
      if (!total && !result.headline && !result.about) {
        toast.error('No profile data found in that file.', {
          description: result.filesFound.length
            ? `Read ${result.filesFound.length} LinkedIn file(s), but they contained no supported profile rows.`
            : 'No Profile, Positions, Education, or Skills CSV was found in this archive.',
        });
        return;
      }
      onImported(result);
      toast.success('LinkedIn data imported', {
        description: `${result.experience.length} positions, ${result.education.length} education entries, ${result.skills.length} skills. Review and press Save.`,
      });
    } catch (e) {
      console.error('LinkedIn import failed:', e);
      toast.error('Could not read that file. Please upload the original LinkedIn ZIP.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Linkedin className="h-4 w-4 text-primary" />
          Import from LinkedIn
        </CardTitle>
        <CardDescription>
          Fill your headline, about, work experience, education and skills automatically from
          your own LinkedIn data — no typing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            Open{' '}
            <a
              href="https://www.linkedin.com/mypreferences/d/download-my-data"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              LinkedIn → Get a copy of your data
            </a>
          </li>
          <li>Choose “Want something in particular?” and tick Profile, Positions, Education, Skills</li>
          <li>Request the archive — LinkedIn emails a ZIP download link (usually within minutes)</li>
          <li>Upload that ZIP here, review the result, then press Save changes</li>
        </ol>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,.csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading archive…
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" /> Upload LinkedIn ZIP or CSV
            </>
          )}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Your file is read directly in your browser — it is never uploaded to a server.
        </p>
      </CardContent>
    </Card>
  );
}
