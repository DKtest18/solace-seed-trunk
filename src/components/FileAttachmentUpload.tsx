import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { HourglassLoader } from '@/components/HourglassLoader';

interface FileAttachmentUploadProps {
  onFileSelect: (file: File) => void;
  onClear: () => void;
  selectedFile: File | null;
  uploading: boolean;
}

export function FileAttachmentUpload({ onFileSelect, onClear, selectedFile, uploading }: FileAttachmentUploadProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 10MB for message attachments
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File must be smaller than 10MB');
        return;
      }
      onFileSelect(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-2">
      {!selectedFile ? (
        <div>
          <Label htmlFor="file-upload" className="cursor-pointer">
            <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary transition-colors flex items-center justify-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to attach file (Max 10MB)
              </span>
            </div>
            <Input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </Label>
        </div>
      ) : (
        <div className="border rounded-lg p-3 flex items-center justify-between bg-muted/50">
          <div className="flex items-center gap-3">
            {uploading ? (
              <HourglassLoader size={48} />
            ) : (
              <FileIcon className="h-5 w-5 text-primary" />
            )}
            <div>
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          {!uploading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
