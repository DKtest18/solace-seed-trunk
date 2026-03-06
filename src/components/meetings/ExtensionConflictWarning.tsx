import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface ExtensionConflictWarningProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  conflictTime: string;
  extensionMinutes: number;
  isPending?: boolean;
}

export function ExtensionConflictWarning({
  open,
  onClose,
  onConfirm,
  conflictTime,
  extensionMinutes,
  isPending = false
}: ExtensionConflictWarningProps) {
  const conflictDate = new Date(conflictTime);
  const formattedTime = format(conflictDate, 'h:mm a');
  const formattedDateTime = format(conflictDate, 'h:mm a on MMMM d');

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <AlertDialogTitle>Calendar Conflict Warning</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                You have another meeting scheduled at <strong className="text-foreground">{formattedTime}</strong>.
              </p>
              <p>
                Extending this meeting by {extensionMinutes} minutes may cause you to be late for your next meeting.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                <p className="text-yellow-600 dark:text-yellow-400">
                  Next meeting starts at {formattedDateTime}
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={isPending}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            {isPending ? 'Extending...' : 'Extend Anyway'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
