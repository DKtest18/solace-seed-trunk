import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { toast } from 'sonner';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function AccountDeletionSettings() {
  const { user, signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);




  const handleDeleteAccount = async () => {
    if (!user || confirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      // Mark profile as deleted (soft delete for legal retention requirements)
      const { error } = await db
        .from('dkai_profiles')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          full_name: '[Deleted User]',
          username: null,
          bio: null,
          avatar_url: null,
          creator_name: null,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Send deletion confirmation email
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dwqpkdatzdqhplgyhigg.supabase.co';
      await supabase.functions.invoke('send-notification-email', {
        body: {
          type: 'account_deletion',
          recipientEmail: user.email,
          data: {
            reason: 'User requested account deletion (DSGVO Art. 17)',
          },
        },
      }).catch(() => {});

      toast.success('Your account has been marked for deletion. You will be signed out.');
      
      // Sign out
      setTimeout(async () => {
        await signOut();
      }, 2000);
    } catch (error) {
      console.error('Account deletion error:', error);
      toast.error('Failed to delete account. Please contact support@dkaimarketplace.com');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">


      {/* Account Deletion - DSGVO Art. 17 */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Delete Account</CardTitle>
          </div>
          <CardDescription>
            Permanently delete your account and all associated data. 
            This action is irreversible (GDPR Art. 17 - Right to Erasure).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-destructive">Warning: This action cannot be undone!</p>
              <ul className="text-muted-foreground list-disc list-inside space-y-1">
                <li>Your profile and personal data will be anonymized</li>
                <li>Your products will be delisted</li>
                <li>Open orders/disputes may be affected</li>
                <li>Transaction records are retained for legal/tax obligations (6-10 years)</li>
                <li>You will lose access to your account immediately</li>
              </ul>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This will permanently delete your account. Your personal data will be 
                    erased per GDPR Art. 17. Transaction records are retained as required by law.
                  </p>
                  <p className="font-medium">
                    We recommend exporting your data before deleting your account.
                  </p>
                  <div className="pt-2">
                    <Label htmlFor="confirm-delete" className="text-sm font-medium">
                      Type <span className="font-mono font-bold">DELETE</span> to confirm:
                    </Label>
                    <Input
                      id="confirm-delete"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="mt-2"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText('')}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== 'DELETE' || isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Permanently Delete Account'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}