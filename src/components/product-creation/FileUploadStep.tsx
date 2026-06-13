import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, File, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePlatformFee } from '@/hooks/usePlatformFee';

interface FileUploadStepProps {
  data: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  onFileSelect: (file: File | null) => void;
  uploadedFile: File | null;
  uploadStatus: string | null;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
  'audio/mp3',
  'text/plain',
  'text/csv',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

export function FileUploadStep({ data, onChange, errors, onFileSelect, uploadedFile, uploadStatus }: FileUploadStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      onChange('fileError', 'File type not allowed. Please upload PDF, ZIP, images, videos, audio, or documents.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      onChange('fileError', 'File size exceeds 5GB limit');
      return;
    }

    onChange('fileError', '');
    onFileSelect(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Product Delivery</h3>
        <p className="text-sm text-muted-foreground">
          Choose how buyers will receive your product
        </p>
      </div>

      <div className="space-y-4">
        <Label>Delivery Method</Label>
        <RadioGroup 
          value={data.delivery_mode} 
          onValueChange={(value) => onChange('delivery_mode', value)}
        >
          <div className="flex items-center space-x-2 border rounded-lg p-4">
            <RadioGroupItem value="via_message" id="via_message" />
            <Label htmlFor="via_message" className="flex-1 cursor-pointer">
              <div className="font-medium">Via Message</div>
              <div className="text-sm text-muted-foreground">
                Send product file through messaging system (recommended)
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-lg p-4">
            <RadioGroupItem value="instant_download" id="instant_download" />
            <Label htmlFor="instant_download" className="flex-1 cursor-pointer">
              <div className="font-medium">Instant Download</div>
              <div className="text-sm text-muted-foreground">
                Buyers can download immediately after purchase
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {(data.delivery_mode === 'instant_download' || data.delivery_mode === 'via_message') && (
        <div className="space-y-4">
          <Label>Product File (Optional)</Label>
          <p className="text-sm text-muted-foreground">
            Upload your product file (max 5GB). Allowed types: PDF, ZIP, images, videos, audio, documents.
          </p>

          {!uploadedFile ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Drag and drop your file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Maximum file size: 5GB
              </p>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileInput}
                accept={ALLOWED_TYPES.join(',')}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Select File
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <File className="w-10 h-10 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{uploadedFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
                  
                  {uploadStatus === 'uploading' && (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Uploading...</span>
                    </div>
                  )}
                  
                  {uploadStatus === 'scanning' && (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Scanning for malware...</span>
                    </div>
                  )}
                  
                  {uploadStatus === 'clean' && (
                    <div className="flex items-center gap-2 mt-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">File scanned - Safe</span>
                    </div>
                  )}
                  
                  {uploadStatus === 'infected' && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        File failed security scan. Please upload a different file.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onFileSelect(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {errors.fileError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.fileError}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> All uploaded files are automatically scanned for malware before being made available to buyers. Executable files and scripts are not allowed for security reasons.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive" className="border-destructive/50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm space-y-2">
          <p><strong>⚠️ Payment & Delivery Rules:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>All payments are held on Stripe until the buyer confirms receipt.</li>
            <li><strong>{sellerPct}% seller / {feePct}% platform fee</strong> — released only after buyer confirmation AND return window expiry.</li>
            <li>You <strong>cannot refuse</strong> to deliver a purchased product. The product must match the description.</li>
            <li>Buyers have a <strong>minimum 24-hour return window</strong> (cannot be waived).</li>
            <li>If a buyer returns within the window, they get <strong>100% refund</strong> to their original payment method.</li>
          </ul>
          <p className="text-xs">Questions? <strong>support@dkaimarketplace.com</strong></p>
        </AlertDescription>
      </Alert>
    </div>
  );
}