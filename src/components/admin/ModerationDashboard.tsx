import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, Ban, Eye, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ModerationLog {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  metadata: {
    categories?: string[];
    severity?: string;
    content_hash?: string;
    sender_id?: string;
  };
  created_at: string;
  moderator_id: string;
}

export function ModerationDashboard() {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
  });

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('moderation_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Type-safe mapping
      const mappedLogs: ModerationLog[] = (data || []).map((log) => ({
        id: log.id,
        action: log.action,
        target_type: log.target_type,
        target_id: log.target_id,
        reason: log.reason || '',
        metadata: (log.metadata as ModerationLog['metadata']) || {},
        created_at: log.created_at || '',
        moderator_id: log.moderator_id || '',
      }));

      setLogs(mappedLogs);

      // Calculate stats
      const critical = mappedLogs.filter(l => l.metadata?.severity === 'critical').length;
      const high = mappedLogs.filter(l => l.metadata?.severity === 'high').length;
      const medium = mappedLogs.filter(l => l.metadata?.severity === 'medium').length;

      setStats({
        total: mappedLogs.length,
        critical,
        high,
        medium,
      });
    } catch (error) {
      console.error('Failed to fetch moderation logs:', error);
      toast.error('Failed to load moderation logs');
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string) => {
    try {
      // Create moderation audit log for ban action
      await supabase.from('moderation_audit_logs').insert({
        target_type: 'user',
        target_id: userId,
        action: 'ban',
        reason: 'Repeated content violations',
      });

      toast.success('User ban logged successfully');
      fetchLogs();
    } catch (error) {
      toast.error('Failed to ban user');
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  const getCategoryIcon = (categories?: string[]) => {
    if (!categories || categories.length === 0) return <Shield className="h-4 w-4" />;
    if (categories.includes('threat') || categories.includes('violence')) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (categories.includes('sexual') || categories.includes('sexual_minor')) {
      return <Ban className="h-4 w-4 text-red-500" />;
    }
    return <Shield className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Content Moderation Dashboard
        </h2>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Blocked</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-500">{stats.high}</div>
            <p className="text-xs text-muted-foreground">High Severity</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{stats.medium}</div>
            <p className="text-xs text-muted-foreground">Medium</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Moderation Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">Recent</TabsTrigger>
              <TabsTrigger value="critical">Critical Only</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <ScrollArea className="h-[400px]">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mb-2" />
                    <p>No moderation events</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs
                      .filter(log => {
                        if (activeTab === 'critical') {
                          return log.metadata?.severity === 'critical';
                        }
                        return true;
                      })
                      .map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            {getCategoryIcon(log.metadata?.categories)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{log.target_type}</span>
                                <Badge className={getSeverityColor(log.metadata?.severity)}>
                                  {log.metadata?.severity || 'unknown'}
                                </Badge>
                                {log.metadata?.categories?.map((cat) => (
                                  <Badge key={cat} variant="outline" className="text-xs">
                                    {cat}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {log.reason}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.created_at), 'PPp')}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {log.metadata?.sender_id && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleBanUser(log.metadata.sender_id!)}
                              >
                                <Ban className="h-4 w-4 mr-1" />
                                Ban User
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Privacy Notice */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Privacy-First Moderation</h4>
              <p className="text-sm text-muted-foreground">
                Content is processed in-memory and immediately discarded after classification.
                Only metadata (hash, categories, severity) is stored for audit purposes.
                No raw text is retained unless explicitly enabled for legal compliance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
