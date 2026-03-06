import { createPortal } from 'react-dom';
import { Copy, Check, X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface MeetingInfoModalProps {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  meetingCode: string;
}

export function MeetingInfoModal({ open, onClose, meetingId, meetingCode }: MeetingInfoModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!open) return null;

  const copyToClipboard = async (text: string, type: 'id' | 'code') => {
    await navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 99999 }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      
      {/* Modal - Full screen on mobile, centered card on desktop */}
      <div className="relative bg-background border border-border rounded-lg p-6 md:p-8 w-full max-w-[500px] max-h-[90vh] overflow-y-auto mx-4 shadow-2xl">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Success indicator */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-green-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-2">Meeting Requested</h2>
        <p className="text-center text-muted-foreground mb-6">Save your meeting details below</p>

        {/* Warning Box */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-600 dark:text-yellow-400 mb-1">
                SAVE THIS INFORMATION
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                You will need the Meeting ID and Code to join your meeting. 
                You can only join after the seller accepts.
              </p>
            </div>
          </div>
        </div>

        {/* Meeting ID */}
        <div className="mb-4">
          <label className="text-sm text-muted-foreground font-medium block mb-2">
            Meeting ID
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted border border-border rounded-lg px-4 py-3 text-sm font-mono break-all select-all">
              {meetingId}
            </code>
            <button 
              onClick={() => copyToClipboard(meetingId, 'id')}
              className="p-3 border border-border rounded-lg hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Copy Meeting ID"
            >
              {copiedId ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Meeting Code */}
        <div className="mb-6">
          <label className="text-sm text-muted-foreground font-medium block mb-2">
            Meeting Code
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-primary/10 border-2 border-primary/30 rounded-lg px-4 py-4 text-2xl font-mono font-bold tracking-[0.3em] text-center select-all">
              {meetingCode}
            </code>
            <button 
              onClick={() => copyToClipboard(meetingCode, 'code')}
              className="p-3 border border-border rounded-lg hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Copy Meeting Code"
            >
              {copiedCode ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Info text */}
        <p className="text-center text-sm text-muted-foreground mb-6">
          We'll notify you when the seller accepts. Check your notifications and email.
        </p>

        {/* Close button */}
        <button 
          onClick={onClose}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          I've Saved This Information
        </button>
      </div>
    </div>,
    document.body
  );
}
