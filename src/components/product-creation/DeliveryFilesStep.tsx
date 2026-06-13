import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, File, X, AlertCircle, Info, BookOpen, FileText, CheckSquare } from 'lucide-react';
import { usePlatformFee } from '@/hooks/usePlatformFee';

interface DeliveryFile {
  file: File;
  label: string;
}

interface DeliveryFilesStepProps {
  deliveryFiles: DeliveryFile[];
  onAddFile: (file: DeliveryFile) => void;
  onRemoveFile: (index: number) => void;
  errors: Record<string, string>;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
const MAX_FILES = 10;

const SUGGESTED_FILES = [
  { icon: BookOpen, label: 'Setup Tutorial / Guide', description: 'Step-by-step instructions for setting up the product' },
  { icon: CheckSquare, label: 'Setup Checklist', description: 'A checklist so buyers can track their setup progress' },
  { icon: FileText, label: 'Workflow Files (e.g. n8n, Zapier)', description: 'Importable automation workflow files' },
  { icon: File, label: 'Configuration Templates', description: 'Pre-configured settings files, .env examples, etc.' },
];

export function DeliveryFilesStep({ deliveryFiles, onAddFile, onRemoveFile, errors }: DeliveryFilesStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(processFile);
    }
    e.target.value = '';
  };

  const processFile = (file: File) => {
    if (deliveryFiles.length >= MAX_FILES) return;
    if (file.size > MAX_FILE_SIZE) return;
    onAddFile({ file, label: file.name });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Delivery Files & Documentation</h3>
        <p className="text-sm text-muted-foreground">
          Upload all files the buyer needs: tutorials, checklists, workflow files, configuration templates, etc.
        </p>
      </div>

      {/* Advice Alert */}
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong className="text-primary">Tip for better reviews:</strong> Including a setup tutorial (PDF), a checklist, and any workflow/configuration files greatly improves buyer satisfaction and your product ratings. Buyers who can easily set up your product are more likely to leave 5-star reviews!
        </AlertDescription>
      </Alert>

      {/* Suggested files */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Suggested files to include:</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SUGGESTED_FILES.map((sf, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
              <sf.icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{sf.label}</p>
                <p className="text-xs text-muted-foreground">{sf.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div>
        <Label className="mb-2 block">Upload Files (max {MAX_FILES}, up to 100MB each)</Label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('delivery-files-input')?.click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, ZIP, JSON, TXT, DOCX, images, videos, and more
          </p>
          <input
            type="file"
            id="delivery-files-input"
            className="hidden"
            multiple
            onChange={handleFileInput}
          />
        </div>
      </div>

      {/* Uploaded files list */}
      {deliveryFiles.length > 0 && (
        <div className="space-y-2">
          <Label>Uploaded Files ({deliveryFiles.length}/{MAX_FILES})</Label>
          {deliveryFiles.map((df, index) => (
            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <File className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{df.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(df.file.size)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onRemoveFile(index)} className="flex-shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {errors.deliveryFilesError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.deliveryFilesError}</AlertDescription>
        </Alert>
      )}

      {/* Important delivery rules */}
      <Alert variant="destructive" className="border-destructive/50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm space-y-2">
          <p><strong>⚠️ Important — You MUST deliver the product:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Once a buyer purchases your product, you <strong>cannot refuse</strong> to deliver it.</li>
            <li>The product <strong>must be exactly as described</strong> in your listing.</li>
            <li><strong>You will NOT receive any payment</strong> until the buyer confirms they received the product.</li>
            <li>All payments are held securely on Stripe: <strong>{sellerPct}% goes to you</strong>, <strong>{feePct}% platform fee</strong> — only after the buyer confirms receipt AND the return window expires.</li>
            <li>If you fail to deliver, the buyer gets a <strong>full refund</strong> and your account may be suspended.</li>
          </ul>
          <p className="text-xs mt-2">
            Questions? Contact <strong>support@dkaimarketplace.com</strong>
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
