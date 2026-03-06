import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Mail, CheckCircle, XCircle, Clock } from "lucide-react";

export default function AdminEmailLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Email Logs</h1>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading logs...</div>
        ) : logs?.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No email logs yet</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {logs?.map((log) => (
              <Card key={log.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{log.email_type}</Badge>
                      <Badge variant={
                        log.status === "sent" ? "default" :
                        log.status === "failed" ? "destructive" :
                        log.status === "bounced" ? "secondary" : "outline"
                      }>
                        {log.status}
                      </Badge>
                    </div>
                    <p className="font-medium">{log.subject}</p>
                    <p className="text-sm text-muted-foreground">To: {log.recipient_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-destructive mt-2">{log.error_message}</p>
                    )}
                  </div>
                  <div>
                    {log.status === "sent" && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {log.status === "failed" && <XCircle className="w-5 h-5 text-red-500" />}
                    {log.status === "pending" && <Clock className="w-5 h-5 text-amber-500" />}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
