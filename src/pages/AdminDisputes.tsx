import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/dkaiDb";
import { useAuth } from "@/contexts/AuthContext";
import { useHasRole } from "@/hooks/useUserRole";
import { Navigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, AlertTriangle, MessageSquare, User, Ban, Search, Eye, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface ReportWithProfiles {
  id: string;
  reporter_id: string;
  target_user_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter?: Profile;
  reported_user?: Profile;
}

export default function AdminDisputes() {
  const { user } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole("admin");
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [banReason, setBanReason] = useState("");

  // Fetch all reports
  const { data: reports, isLoading: reportsLoading } = useQuery<ReportWithProfiles[]>({
    queryKey: ["admin-reports", statusFilter],
    queryFn: async (): Promise<ReportWithProfiles[]> => {
      let query = db
        .from("dkai_reports")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profiles for reporters and reported users
      if (data && data.length > 0) {
        const userIds = [...new Set([
          ...data.map(r => r.reporter_id),
          ...data.map(r => r.target_user_id)
        ])];
        
        const { data: profiles } = await db
          .from("dkai_profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map<string, Profile>(profiles?.map(p => [p.id, p as Profile]) || []);
        
        return data.map(report => ({
          ...report,
          reporter: profileMap.get(report.reporter_id),
          reported_user: profileMap.get(report.target_user_id)
        })) as ReportWithProfiles[];
      }
      
      return (data || []) as ReportWithProfiles[];
    },
    enabled: !!user && isAdmin,
  });

  // Fetch all conversations for admin view
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: async () => {
      const { data: threads, error } = await db
        .from("dkai_threads")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      if (!threads || threads.length === 0) return [];
      
      // Get participants for each thread
      const { data: participants } = await db
        .from("dkai_chat_participants")
        .select("thread_id, user_id")
        .in("thread_id", threads.map(t => t.id));
      
      // Get unique user IDs
      const userIds = [...new Set(participants?.map(p => p.user_id) || [])];
      
      const { data: profiles } = await db
        .from("dkai_profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return threads.map(thread => {
        const threadParticipants = participants?.filter(p => p.thread_id === thread.id) || [];
        return {
          ...thread,
          participants: threadParticipants.map(p => profileMap.get(p.user_id))
        };
      });
    },
    enabled: !!user && isAdmin,
  });

  // Load thread messages
  const loadThreadMessages = async (threadId: string) => {
    const { data, error } = await db
      .from("dkai_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    
    if (error) {
      toast.error("Failed to load messages");
      return;
    }
    
    // Get sender profiles
    const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", senderIds);
    
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    
    setThreadMessages(data?.map(msg => ({
      ...msg,
      sender: profileMap.get(msg.sender_id)
    })) || []);
    setSelectedThread(threadId);
  };

  // Ban user mutation
  const banUser = useMutation({
    mutationFn: async ({ userId, reportId }: { userId: string; reportId: string }) => {
      // Update user roles to mark as banned
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({
          user_id: userId,
          role: "banned" as any,
        });

      // Hide all products from banned user
      const { error: productsError } = await supabase
        .from("products")
        .update({ is_published: false, available: false })
        .eq("seller_id", userId);

      // Update report status
      const { error: reportError } = await supabase
        .from("reports")
        .update({
          status: "reviewed",
        })
        .eq("id", reportId);

      // Create audit log
      await supabase.from("payment_audit_logs").insert({
        actor_id: user?.id,
        actor_role: "admin",
        action: "ban_user",
        target_table: "profiles",
        target_id: userId,
        new_data: { reason: banReason, report_id: reportId },
      });

      // Notify the banned user
      await supabase.from("in_app_notifications").insert({
        user_id: userId,
        title: "Account Suspended",
        message: `Your account has been suspended due to policy violation. Reason: ${banReason || "Terms of Service violation"}`,
        type: "system",
      });

      if (roleError || productsError || reportError) {
        throw new Error("Failed to complete ban action");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("User has been banned");
      setBanReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to ban user");
    },
  });

  // Dismiss report mutation
  const dismissReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("Report dismissed");
    },
    onError: () => {
      toast.error("Failed to dismiss report");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "reviewed":
        return <Badge variant="default">Reviewed</Badge>;
      case "dismissed":
        return <Badge variant="secondary">Dismissed</Badge>;
      case "escalated":
        return <Badge className="bg-amber-500">Escalated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredReports = reports?.filter(report => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      report.reporter?.full_name?.toLowerCase().includes(search) ||
      report.reporter?.username?.toLowerCase().includes(search) ||
      report.reported_user?.full_name?.toLowerCase().includes(search) ||
      report.reported_user?.username?.toLowerCase().includes(search) ||
      report.reason?.toLowerCase().includes(search)
    );
  });

  if (roleLoading || !user) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Disputes & Reports</h1>
        </div>

        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              User Reports
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>User Reports</CardTitle>
                <CardDescription>Review and manage user reports</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search reports..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reports</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reportsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !filteredReports || filteredReports.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No reports found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Reported User</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            {format(new Date(report.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={report.reporter?.avatar_url} />
                                <AvatarFallback>
                                  <User className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                              <span>{report.reporter?.full_name || report.reporter?.username || "Unknown"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link to={`/profile/${report.target_user_id}`} className="flex items-center gap-2 hover:underline">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={report.reported_user?.avatar_url} />
                                <AvatarFallback>
                                  <User className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                              <span>{report.reported_user?.full_name || report.reported_user?.username || "Unknown"}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {report.reason}
                          </TableCell>
                          <TableCell>{getStatusBadge(report.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Report Details</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label>Reporter</Label>
                                        <p className="text-sm text-muted-foreground">
                                          {report.reporter?.full_name || report.reporter?.username}
                                        </p>
                                      </div>
                                      <div>
                                        <Label>Reported User</Label>
                                        <Link to={`/profile/${report.target_user_id}`} className="text-sm text-primary hover:underline block">
                                          {report.reported_user?.full_name || report.reported_user?.username}
                                        </Link>
                                      </div>
                                    </div>
                                    <div>
                                      <Label>Reason</Label>
                                      <p className="text-sm font-medium">{report.reason}</p>
                                    </div>
                                    <div>
                                      <Label>Details</Label>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {report.details || "No additional details provided"}
                                      </p>
                                    </div>
                                    <div>
                                      <Label>Submitted</Label>
                                      <p className="text-sm text-muted-foreground">
                                        {format(new Date(report.created_at), "PPpp")}
                                      </p>
                                    </div>

                                    {report.status === "open" && (
                                      <div className="flex gap-2 pt-4 border-t">
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button variant="destructive" className="flex-1">
                                              <Ban className="h-4 w-4 mr-2" />
                                              Ban User
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent>
                                            <DialogHeader>
                                              <DialogTitle>Ban User</DialogTitle>
                                              <DialogDescription>
                                                This will suspend the user's account and hide all their listings.
                                              </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                              <div>
                                                <Label>Ban Reason</Label>
                                                <Textarea
                                                  value={banReason}
                                                  onChange={(e) => setBanReason(e.target.value)}
                                                  placeholder="Reason for banning this user..."
                                                />
                                              </div>
                                              <Button
                                                variant="destructive"
                                                className="w-full"
                                                onClick={() => banUser.mutate({ userId: report.target_user_id, reportId: report.id })}
                                                disabled={banUser.isPending}
                                              >
                                                {banUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                Confirm Ban
                                              </Button>
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                        <Button
                                          variant="outline"
                                          className="flex-1"
                                          onClick={() => dismissReport.mutate(report.id)}
                                          disabled={dismissReport.isPending}
                                        >
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Dismiss
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conversations List */}
              <Card>
                <CardHeader>
                  <CardTitle>All Conversations</CardTitle>
                  <CardDescription>View and monitor user conversations</CardDescription>
                </CardHeader>
                <CardContent>
                  {conversationsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : !conversations || conversations.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No conversations found</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      {conversations.map((conv: any) => (
                        <div
                          key={conv.id}
                          onClick={() => loadThreadMessages(conv.id)}
                          className={`p-4 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
                            selectedThread === conv.id ? "bg-accent" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                              {conv.participants?.slice(0, 2).map((p: any, i: number) => (
                                <Avatar key={i} className="h-8 w-8 border-2 border-background">
                                  <AvatarImage src={p?.avatar_url} />
                                  <AvatarFallback>
                                    <User className="h-4 w-4" />
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {conv.participants?.map((p: any) => p?.full_name || p?.username).join(" & ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(conv.updated_at), "MMM d, HH:mm")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Message View */}
              <Card>
                <CardHeader>
                  <CardTitle>Messages</CardTitle>
                  <CardDescription>
                    {selectedThread ? "Viewing conversation" : "Select a conversation to view messages"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedThread ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mr-2" />
                      Select a conversation
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-4">
                        {threadMessages.map((msg) => (
                          <div key={msg.id} className="flex gap-3">
                            <Link to={`/profile/${msg.sender_id}`}>
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={msg.sender?.avatar_url} />
                                <AvatarFallback>
                                  <User className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                            </Link>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {msg.sender?.full_name || msg.sender?.username}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(msg.created_at), "HH:mm")}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
