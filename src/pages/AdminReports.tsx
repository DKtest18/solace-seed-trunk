import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Shield, Ban, Check, X, AlertTriangle, Clock, Trash2 } from "lucide-react";

type SanctionType = "ban" | "suspend" | "delete" | "warn";

interface SanctionModalState {
  open: boolean;
  userId: string | null;
  type: SanctionType;
}

export default function AdminReports() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [sanctionModal, setSanctionModal] = useState<SanctionModalState>({
    open: false,
    userId: null,
    type: "ban",
  });
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionDuration, setSanctionDuration] = useState("");
  const [isSanctioning, setIsSanctioning] = useState(false);

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ["admin-reports", statusFilter],
    queryFn: async () => {
      let query = (supabase.from as any)("dkai_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const handleResolve = async (reportId: string, action: "resolved" | "dismissed") => {
    try {
      const { error } = await (supabase.from as any)("dkai_reports")
        .update({
          status: action,
          admin_notes: adminNotes,
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", reportId);

      if (error) throw error;
      toast.success(`Report ${action}`);
      refetch();
      setSelectedReport(null);
      setAdminNotes("");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openSanctionModal = (userId: string, type: SanctionType) => {
    setSanctionModal({ open: true, userId, type });
    setSanctionReason("");
    setSanctionDuration(type === "warn" ? "" : "24");
  };

  const handleSanction = async () => {
    if (!sanctionModal.userId || !sanctionReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    setIsSanctioning(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-sanctions", {
        body: {
          action: "create",
          user_id: sanctionModal.userId,
          sanction_type: sanctionModal.type,
          reason: sanctionReason,
          duration_hours: sanctionModal.type !== "warn" && sanctionDuration 
            ? parseInt(sanctionDuration) 
            : null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const typeLabels: Record<SanctionType, string> = {
        ban: "banned",
        suspend: "suspended",
        delete: "deleted",
        warn: "warned",
      };

      toast.success(`User ${typeLabels[sanctionModal.type]} successfully`);
      setSanctionModal({ open: false, userId: null, type: "ban" });
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to apply sanction");
    } finally {
      setIsSanctioning(false);
    }
  };

  const getSanctionTypeLabel = (type: SanctionType): string => {
    const labels: Record<SanctionType, string> = {
      ban: "Permanent Ban",
      suspend: "Temporary Suspension",
      delete: "Delete Account",
      warn: "Warning",
    };
    return labels[type];
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Content Reports</h1>
        </div>

        <div className="mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="reviewing">Under Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading reports...</div>
        ) : reports?.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No reports found</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports?.map((report) => (
              <Card key={report.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={
                        report.status === "open" ? "default" :
                        report.status === "reviewing" ? "secondary" :
                        report.status === "resolved" ? "outline" : "destructive"
                      }>
                        {report.status}
                      </Badge>
                      <Badge>{report.reason}</Badge>
                      <Badge variant="outline">{report.report_type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Reported {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  {report.details && (
                    <p><span className="font-medium">Details:</span> {report.details}</p>
                  )}
                </div>

                {selectedReport === report.id ? (
                  <div className="space-y-3 mt-4 pt-4 border-t">
                    <Textarea
                      placeholder="Admin notes..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleResolve(report.id, "resolved")}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(report.id, "dismissed")}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Dismiss
                      </Button>
                      {report.reported_user_id && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openSanctionModal(report.reported_user_id, "warn")}
                          >
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            Warn
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openSanctionModal(report.reported_user_id, "suspend")}
                          >
                            <Clock className="w-4 h-4 mr-1" />
                            Temp Ban
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openSanctionModal(report.reported_user_id, "ban")}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Perm Ban
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openSanctionModal(report.reported_user_id, "delete")}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedReport(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : report.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedReport(report.id)}
                  >
                    Take Action
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Sanction Modal */}
        <Dialog open={sanctionModal.open} onOpenChange={(open) => setSanctionModal({ ...sanctionModal, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getSanctionTypeLabel(sanctionModal.type)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter the reason for this action..."
                  value={sanctionReason}
                  onChange={(e) => setSanctionReason(e.target.value)}
                  rows={3}
                />
              </div>
              {sanctionModal.type === "suspend" && (
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="24"
                    value={sanctionDuration}
                    onChange={(e) => setSanctionDuration(e.target.value)}
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for permanent suspension
                  </p>
                </div>
              )}
              {sanctionModal.type === "delete" && (
                <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive">
                  <strong>Warning:</strong> This will permanently delete the user's account, 
                  hide all their products, and block their email from re-registering.
                </div>
              )}
              {sanctionModal.type === "ban" && (
                <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive">
                  <strong>Warning:</strong> This will permanently ban the user and block 
                  their email from re-registering.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSanctionModal({ open: false, userId: null, type: "ban" })}
              >
                Cancel
              </Button>
              <Button
                variant={sanctionModal.type === "warn" ? "secondary" : "destructive"}
                onClick={handleSanction}
                disabled={isSanctioning || !sanctionReason.trim()}
              >
                {isSanctioning ? "Processing..." : `Apply ${getSanctionTypeLabel(sanctionModal.type)}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}