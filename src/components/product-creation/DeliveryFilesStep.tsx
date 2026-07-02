import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, File, X, AlertCircle, Info, BookOpen, FileText, CheckSquare, Zap, Mail } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePlatformFee } from '@/hooks/usePlatformFee';

interface DeliveryFile {
  file: File;
  label: string;
}

interface DeliveryFilesStepProps {
  data: {
    delivery_mode: string;
    delivery_time_hours: number | null;
    available_quantity: string;
  };
  onChange: (field: string, value: any) => void;
  deliveryFiles: DeliveryFile[];
  onAddFile: (file: DeliveryFile) => void;
  onRemoveFile: (index: number) => void;
  errors: Record<string, string>;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_FILES = 10;

const SUGGESTED_FILES = [
  { icon: BookOpen, label: 'Setup Tutorial / Guide', description: 'Step-by-step instructions for setting up the product' },
  { icon: CheckSquare, label: 'Setup Checklist', description: 'A checklist so buyers can track their setup progress' },
  { icon: FileText, label: 'Workflow Files (e.g. n8n, Zapier)', description: 'Importable automation workflow files' },
  { icon: File, label: 'Configuration Templates', description: 'Pre-configured settings files, .env examples, etc.' },
];

export function DeliveryFilesStep({ data, onChange, deliveryFiles, onAddFile, onRemoveFile, errors }: DeliveryFilesStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
  const [dragActive, setDragActive] = useState(false);

  const mode = data.delivery_mode === 'instant' || data.delivery_mode === 'manual'
    ? data.delivery_mode
    : 'instant';

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
    if (e.dataTransfer.files) Array.from(e.dataTransfer.files).forEach(processFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) Array.from(e.target.files).forEach(processFile);
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
        <h3 className="text-lg font-semibold mb-2">Delivery & Inventory</h3>
        <p className="text-sm text-muted-foreground">
          Choose how the buyer receives your product, upload the files, and (optionally) cap available inventory.
        </p>
      </div>

      {/* Delivery Mode */}
      <div>
        <Label className="mb-2 block">How will you deliver this product?</Label>
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            onChange('delivery_mode', v);
            if (v === 'instant') onChange('delivery_time_hours', null);
            else if (!data.delivery_time_hours) onChange('delivery_time_hours', 24);
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <label
            htmlFor="mode-instant"
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              mode === 'instant' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="instant" id="mode-instant" className="mt-1" />
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-medium">Instant download</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Buyer receives access immediately after payment via short-lived signed URLs. Requires ≥ 1 uploaded file.
              </p>
            </div>
          </label>

          <label
            htmlFor="mode-manual"
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              mode === 'manual' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="manual" id="mode-manual" className="mt-1" />
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span className="font-medium">Manual delivery by seller</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You deliver to the buyer's email within your chosen window. File upload optional.
              </p>
            </div>
          </label>
        </RadioGroup>
        {errors.deliveryModeError && (
          <p className="text-xs text-destructive mt-2">{errors.deliveryModeError}</p>
        )}
      </div>

      {/* Manual delivery time */}
      {mode === 'manual' && (
        <div>
          <Label className="mb-2 block">Estimated delivery time (max 48 hours)</Label>
          <RadioGroup
            value={String(data.delivery_time_hours ?? 24)}
            onValueChange={(v) => onChange('delivery_time_hours', parseInt(v))}
            className="grid grid-cols-3 gap-3"
          >
            {[12, 24, 48].map((h) => (
              <label
                key={h}
                htmlFor={`hrs-${h}`}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  (data.delivery_time_hours ?? 24) === h ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value={String(h)} id={`hrs-${h}`} />
                <span className="text-sm font-medium">Within {h}h</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Available Quantity */}
      <div>
        <Label htmlFor="avail-qty" className="mb-2 block">
          Available quantity <span className="text-muted-foreground font-normal">(leave empty for unlimited)</span>
        </Label>
        <input
          id="avail-qty"
          type="number"
          min={1}
          placeholder="Unlimited"
          value={data.available_quantity ?? ''}
          onChange={(e) => onChange('available_quantity', e.target.value)}
          className="w-full max-w-xs h-10 px-3 rounded-md border bg-background text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          When the cap is reached, the listing shows "Sold out" and further purchases are blocked automatically.
        </p>
      </div>

      {/* Advice */}
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong className="text-primary">Tip:</strong> Including a setup tutorial, checklist, and workflow/configuration files leads to higher ratings.
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
        <Label className="mb-2 block">
          Upload Files (max {MAX_FILES}, up to 100MB each)
          {mode === 'instant' && <span className="text-destructive ml-1">*</span>}
        </Label>
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
          <p className="text-xs text-muted-foreground mt-1">PDF, ZIP, JSON, TXT, DOCX, images, videos, and more</p>
          <input type="file" id="delivery-files-input" className="hidden" multiple onChange={handleFileInput} />
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
          <p><strong>Important — You MUST deliver the product:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Once a buyer purchases, you <strong>cannot refuse</strong> to deliver.</li>
            <li>The product <strong>must be exactly as described</strong> in your listing.</li>
            <li><strong>You will NOT receive any payment</strong> until the buyer confirms receipt.</li>
            <li>Funds held via Stripe: <strong>{sellerPct}% to you</strong>, <strong>{feePct}% platform fee</strong>.</li>
            <li>Failure to deliver triggers a <strong>full refund</strong> and possible account suspension.</li>
          </ul>
          <p className="text-xs mt-2">Questions? <strong>support@dkaimarketplace.com</strong></p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
