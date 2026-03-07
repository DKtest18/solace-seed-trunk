import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/dkaiDb";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "user" | "product" | "comment" | "post";
  targetId: string;
  targetName?: string;
}

const REPORT_REASONS = [
  { value: "illegal", label: "Illegal Activity" },
  { value: "harmful", label: "Harmful Content" },
  { value: "scam", label: "Scam/Fraud" },
  { value: "spam", label: "Spam" },
  { value: "copyright", label: "Copyright Infringement" },
  { value: "harassment", label: "Harassment" },
  { value: "nsfw", label: "NSFW Content" },
  { value: "fraud", label: "Payment Fraud" },
  { value: "stolen_software", label: "Stolen Software" },
  { value: "fake_profile", label: "Fake Profile" },
];

export function ReportDialog({ open, onOpenChange, targetType, targetId, targetName }: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please log in to report");
      return;
    }
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    setSubmitting(true);
    try {
      const reportData: any = {
        reporter_id: user.id,
        report_type: targetType,
        reason,
        details: details || null,
      };

      if (targetType === "user") reportData.reported_user_id = targetId;
      if (targetType === "product") reportData.reported_product_id = targetId;
      if (targetType === "comment") reportData.reported_comment_id = targetId;

      const { error } = await db.from("dkai_reports").insert(reportData);
      if (error) throw error;

      toast.success("Report submitted successfully");
      onOpenChange(false);
      setReason("");
      setDetails("");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {targetType}</DialogTitle>
          <DialogDescription>
            {targetName && `Reporting: ${targetName}`}
            <br />
            Help us keep the marketplace safe by reporting inappropriate content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Reason for report</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="mt-2">
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

          <div>
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional information..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
