import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, File, X, AlertCircle, Info, Zap, Mail, Settings, AlertTriangle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePlatformFee } from '@/hooks/usePlatformFee';
import { SetupRequirementsInline, type Spec } from './SetupRequirementsInline';

import type { DeliveryFileRow } from '@/hooks/useDeliveryFiles';

interface DeliveryFilesStepProps {
  data: {
    delivery_mode: string;
    delivery_time_hours: number | null;
    available_quantity: string;
    product_type?: string;
    license_exclusive_enabled?: boolean;
    setup_requirements?: Spec[];
    setup_access_window_hours?: number;
    setup_no_credentials?: boolean;
  };
  onChange: (field: string, value: any) => void;
  deliveryFiles: DeliveryFileRow[];
  onAddFile: (file: File) => void;
  onRemoveFile: (id: string) => void;
  uploading?: boolean;
  errors: Record<string, string>;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_FILES = 10;

const SUGGESTED_BY_TYPE: Record<string, string[]> = {
  workflow: ['Workflow JSON (n8n / Zapier / Make)', 'Step-by-step setup guide', 'Config templates / .env example'],
  agent:    ['Agent config file', 'System prompt / instructions', '.env example', 'Setup guide'],
  prompt:   ['Prompt file (.md / .txt)', 'Usage examples', 'Recommended model + parameters'],
  dataset:  ['Data file (.csv / .jsonl / .parquet)', 'Schema / README', 'Sample rows'],
  template: ['Template file', 'How-to guide', 'Screenshots'],
};

export function DeliveryFilesStep({ data, onChange, deliveryFiles, onAddFile, onRemoveFile, uploading, errors }: DeliveryFilesStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const mode = ['instant', 'manual', 'setup'].includes(data.delivery_mode) ? data.delivery_mode : 'instant';
  const suggestions = SUGGESTED_BY_TYPE[(data.product_type || 'agent').toLowerCase()] || SUGGESTED_BY_TYPE.agent;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files) Array.from(e.dataTransfer.files).forEach(processFile);
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) Array.from(e.target.files).forEach(processFile);
    e.target.value = '';
  };
  const processFile = (file: File) => {
    if (deliveryFiles.length >= MAX_FILES) {
      setLocalError(`You can upload at most ${MAX_FILES} files. "${file.name}" was not added.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setLocalError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 100 MB per file.`);
      return;
    }
    setLocalError(null);
    onAddFile(file);
  };
  const fmt = (b: number) => b < 1024 ? b + ' B' : b < 1024 * 1024 ? (b / 1024).toFixed(1) + ' KB' : (b / (1024 * 1024)).toFixed(1) + ' MB';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Delivery & Inventory</h3>
        <p className="text-sm text-muted-foreground">Choose how the buyer receives your product.</p>
      </div>

      <div>
        <Label className="mb-2 block">How will you deliver this product?</Label>
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            onChange('delivery_mode', v);
            if (v === 'instant') onChange('delivery_time_hours', null);
            else if (v === 'manual' && !data.delivery_time_hours) onChange('delivery_time_hours', 24);
            if (v === 'setup') onChange('requires_setup_credentials', true);
            else onChange('requires_setup_credentials', false);
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {[
            { id: 'instant', icon: Zap, title: 'Instant download',
              desc: 'Buyer receives access immediately via signed URLs. Requires ≥ 1 uploaded file.' },
            { id: 'manual', icon: Mail, title: 'Manual delivery by seller',
              desc: 'You deliver to the buyer within your chosen window (12/24/48h).' },
            { id: 'setup', icon: Settings, title: 'Setup by seller',
              desc: 'You install / configure for the buyer. Optionally collect temporary credentials.' },
          ].map((opt) => (
            <label key={opt.id} htmlFor={`mode-${opt.id}`}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                mode === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}>
              <RadioGroupItem value={opt.id} id={`mode-${opt.id}`} className="mt-1" />
              <div>
                <div className="flex items-center gap-2"><opt.icon className="h-4 w-4 text-primary" /><span className="font-medium">{opt.title}</span></div>
                <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
        {errors.deliveryModeError && <p className="text-xs text-destructive mt-2">{errors.deliveryModeError}</p>}
      </div>

      {mode === 'manual' && (
        <div>
          <Label className="mb-2 block">Estimated delivery time (max 48 hours) *</Label>
          <RadioGroup value={String(data.delivery_time_hours ?? 24)}
            onValueChange={(v) => onChange('delivery_time_hours', parseInt(v))}
            className="grid grid-cols-3 gap-3">
            {[12, 24, 48].map((h) => (
              <label key={h} htmlFor={`hrs-${h}`}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  (data.delivery_time_hours ?? 24) === h ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}>
                <RadioGroupItem value={String(h)} id={`hrs-${h}`} />
                <span className="text-sm font-medium">Within {h}h</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      {mode === 'setup' && (
        <div className="border rounded-lg p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold">Setup Requirements (what you need from the buyer)</h4>
            <p className="text-xs text-muted-foreground">
              Define each secret / spec the buyer will hand over so you can install the product.
              Buyers see the list on the product page before purchase.
            </p>
          </div>
          <SetupRequirementsInline
            specs={Array.isArray(data.setup_requirements) ? data.setup_requirements : []}
            onSpecsChange={(s) => onChange('setup_requirements', s)}
            windowHours={data.setup_access_window_hours ?? 48}
            onWindowHoursChange={(h) => onChange('setup_access_window_hours', h)}
            noCredentials={!!data.setup_no_credentials}
            onNoCredentialsChange={(v) => onChange('setup_no_credentials', v)}
          />
          {errors.setupRequirementsError && (
            <p className="text-xs text-destructive">{errors.setupRequirementsError}</p>
          )}
        </div>
      )}

      {data.license_exclusive_enabled && (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Exclusive Buyout enabled.</strong> On an exclusive sale you must additionally deliver ALL source files
            and the product will be permanently delisted from the marketplace.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="avail-qty" className="mb-2 block">
          Available quantity <span className="text-muted-foreground font-normal">(leave empty for unlimited)</span>
        </Label>
        <input id="avail-qty" type="number" min={1} placeholder="Unlimited"
          value={data.available_quantity ?? ''} onChange={(e) => onChange('available_quantity', e.target.value)}
          className="w-full max-w-xs h-10 px-3 rounded-md border bg-background text-sm" />
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong className="text-primary">Suggested files for a {(data.product_type || 'agent')}:</strong>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </AlertDescription>
      </Alert>

      <div>
        <Label className="mb-2 block">
          Upload Files (max {MAX_FILES}, up to 100MB each){mode === 'instant' && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          onClick={() => document.getElementById('delivery-files-input')?.click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, ZIP, JSON, TXT, DOCX, images, videos, and more</p>
          <input type="file" id="delivery-files-input" className="hidden" multiple onChange={handleFileInput} disabled={uploading} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Files are uploaded and saved to your product immediately — they are stored privately and only
          reachable through short-lived signed links.
        </p>
      </div>

      {localError && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{localError}</AlertDescription></Alert>
      )}

      {deliveryFiles.length > 0 && (
        <div className="space-y-2">
          <Label>Uploaded Files ({deliveryFiles.length}/{MAX_FILES})</Label>
          {deliveryFiles.map((df) => (
            <div key={df.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <File className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{df.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(df.file_size)}
                  {df.uploading ? ' · uploading…' : df.error ? '' : ' · saved'}
                </p>
                {df.error && <p className="text-xs text-destructive break-words mt-1">{df.error}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => onRemoveFile(df.id)} disabled={df.uploading}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {errors.deliveryFilesError && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{errors.deliveryFilesError}</AlertDescription></Alert>
      )}

      <Alert variant="destructive" className="border-destructive/50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm space-y-2">
          <p><strong>Important — You MUST deliver the product:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>You <strong>cannot refuse</strong> to deliver after purchase.</li>
            <li>The product must be <strong>exactly as described</strong>.</li>
            <li>Payout split: <strong>{sellerPct}% to you</strong>, <strong>{feePct}% platform fee</strong>.</li>
            <li>Non-delivery triggers a <strong>full refund</strong> and possible suspension.</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
