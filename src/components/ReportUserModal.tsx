import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Flag } from "lucide-react";

const REPORT_REASONS = [
  { value: "illegal_activity", label: "Illegal Activity" },
  { value: "copyright_stolen", label: "Copyright / Stolen Software" },
  { value: "scam_nonpayment", label: "Scam or Non-payment" },
  { value: "child_sexual_content", label: "Child or Sexual Content" },
  { value: "hate_harassment", label: "Hate Speech / Harassment" },
  { value: "fraudulent_product", label: "Fraudulent Product" },
  { value: "graphic_harmful", label: "Graphic or Harmful Content" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

interface ReportUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName?: string;
}

export function ReportUserModal({ open, onOpenChange, targetUserId, targetUserName }: ReportUserModalProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a reason for reporting");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-report", {
        body: {
          target_user_id: targetUserId,
          reason: REPORT_REASONS.find(r => r.value === reason)?.label || reason,
          details: details.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Report submitted successfully. We will review it shortly.");
      onOpenChange(false);
      setReason("");
      setDetails("");
    } catch (error: any) {
      console.error("Error submitting report:", error);
      toast.error(error.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report User
          </DialogTitle>
          <DialogDescription>
            {targetUserName 
              ? `Report ${targetUserName} for violating our community guidelines.`
              : "Report this user for violating our community guidelines."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Why are you reporting this user?</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Additional details (optional but recommended)</Label>
            <Textarea
              id="details"
              placeholder="Please provide any additional context that might help us review this report..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {details.length}/1000 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason} variant="destructive">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
