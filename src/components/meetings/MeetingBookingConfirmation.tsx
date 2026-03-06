import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, AlertCircle, Calendar, Clock, Video } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

interface MeetingBookingConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingCode: string;
  meetingType: string;
  meetingDate: Date;
  meetingTime: string;
  sellerName: string;
  isPaid: boolean;
}

export function MeetingBookingConfirmation({
  open,
  onOpenChange,
  meetingId,
  meetingCode,
  meetingType,
  meetingDate,
  meetingTime,
  sellerName,
  isPaid
}: MeetingBookingConfirmationProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

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

  // Safety check - if no meeting ID or code, show error state
  if (!meetingId || !meetingCode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Booking Error</DialogTitle>
            <DialogDescription>
              Meeting was created but credentials were not returned. 
              Please check "My Meetings" page for your meeting details.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Meeting Request Submitted!</DialogTitle>
              <DialogDescription>
                Your meeting with {sellerName} has been requested.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  SAVE THESE DETAILS — YOU WILL NEED THEM TO JOIN
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                  You can only join the meeting after the seller accepts your request.
                </p>
              </div>
            </div>
          </div>

          {/* Meeting Credentials */}
          <Card className="p-4 space-y-4 border-2 border-primary/20 bg-primary/5">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Video className="h-5 w-5" />
              Your Meeting Credentials
            </h3>
            
            {/* Meeting ID */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground font-medium">Meeting ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background border rounded px-3 py-2 text-sm font-mono break-all">
                  {meetingId}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(meetingId, 'id')}
                >
                  {copiedId ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Meeting Code */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground font-medium">Meeting Code</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background border rounded px-3 py-2 text-2xl font-mono font-bold tracking-widest text-center">
                  {meetingCode}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(meetingCode, 'code')}
                >
                  {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </Card>

          {/* Meeting Details */}
          <Card className="p-4 space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Meeting Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-muted-foreground" />
                <span>{meetingType}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(meetingDate, 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{meetingTime.slice(0, 5)}</span>
              </div>
              <div>
                <Badge variant={isPaid ? 'default' : 'secondary'}>
                  {isPaid ? 'Paid' : 'Free'}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Next Steps */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">What happens next?</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>The seller will review your request</li>
              <li>You'll receive a notification when they respond</li>
              <li>Once accepted, use "Join Meeting" to enter with your ID and Code</li>
            </ol>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => {
            copyToClipboard(`Meeting ID: ${meetingId}\nMeeting Code: ${meetingCode}`, 'id');
          }}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Both
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
