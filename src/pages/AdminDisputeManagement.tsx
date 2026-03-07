import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, Clock, AlertTriangle, CheckCircle, XCircle, Search, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import { AppLayout } from '@/components/AppLayout';
import { useTranslation } from 'react-i18next';

export default function AdminDisputeManagement() {
  const { user } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all disputes
  const { data: disputes, isLoading } = useQuery({
    queryKey: ['admin-disputes', statusFilter],
    queryFn: async () => {
      let query = db
        .from('dkai_disputes')
        .select(`*, dkai_products (id, title)`)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profiles for each dispute
      const enriched = await Promise.all((data || []).map(async (d) => {
        const [buyerRes, sellerRes] = await Promise.all([
          db.from('dkai_profiles').select('id, full_name, creator_name, username').eq('id', d.buyer_id).single(),
          db.from('dkai_profiles').select('id, full_name, creator_name, username').eq('id', d.seller_id).single()
        ]);
        return { ...d, buyer: buyerRes.data, seller: sellerRes.data };
      }));
      
      return enriched;

    },
    enabled: !!user && isAdmin,
  });

  // Fetch dispute settings
  const { data: settings } = useQuery({
    queryKey: ['dispute-settings'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_dispute_settings')
        .select('*');
      if (error) throw error;
      return data?.reduce((acc, s) => {
        const val = typeof s.setting_value === 'object' && s.setting_value !== null && 'value' in s.setting_value
          ? (s.setting_value as { value: number }).value
          : typeof s.setting_value === 'number' 
            ? s.setting_value 
            : 7;
        return { ...acc, [s.setting_key]: val };
      }, {} as Record<string, number>);
    },
    enabled: !!user && isAdmin,
  });

  // Start mediation mutation
  const startMediation = useMutation({
    mutationFn: async (disputeId: string) => {
      const { error } = await db
        .from('dkai_disputes')
        .update({
          status: 'in_progress',
          admin_mediation_started_at: new Date().toISOString()
        })
        .eq('id', disputeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      toast.success('Mediation started');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { error } = await supabase
        .from('dispute_settings')
        .update({ 
          setting_value: { value },
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('setting_key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute-settings'] });
      toast.success('Setting updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const filteredDisputes = disputes?.filter(d => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      d.subject?.toLowerCase().includes(query) ||
      d.products?.title?.toLowerCase().includes(query) ||
      d.buyer?.username?.toLowerCase().includes(query) ||
      d.seller?.username?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      open: { variant: 'default' },
      pending: { variant: 'secondary' },
      in_progress: { variant: 'secondary' },
      seller_authorized_refund: { variant: 'outline' },
      resolved: { variant: 'outline' },
      closed: { variant: 'outline' }
    };

    return (
      <Badge variant={statusConfig[status]?.variant || 'default'}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const isOverdue = (dispute: any) => {
    if (dispute.seller_response_deadline && !dispute.seller_responded_at) {
      return new Date(dispute.seller_response_deadline) < new Date();
    }
    return false;
  };

  const stats = {
    total: disputes?.length || 0,
    open: disputes?.filter(d => d.status === 'open').length || 0,
    inProgress: disputes?.filter(d => d.status === 'in_progress').length || 0,
    overdue: disputes?.filter(d => isOverdue(d)).length || 0
  };

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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('disputes.adminTitle', 'Dispute Management')}</h1>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Disputes</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold">{stats.open}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                </div>
                <Loader2 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="disputes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="disputes">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>All Disputes</CardTitle>
                    <CardDescription>Manage and resolve buyer/seller disputes</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-[200px]"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !filteredDisputes || filteredDisputes.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No disputes found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Seller</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDisputes.map((dispute: any) => (
                        <TableRow key={dispute.id} className={isOverdue(dispute) ? 'bg-destructive/10' : ''}>
                          <TableCell className="text-sm">
                            {format(new Date(dispute.created_at), 'MMM d')}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {dispute.subject}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {dispute.products?.title}
                          </TableCell>
                          <TableCell>
                            {dispute.buyer?.creator_name || dispute.buyer?.username}
                          </TableCell>
                          <TableCell>
                            {dispute.seller?.creator_name || dispute.seller?.username}
                          </TableCell>
                          <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                          <TableCell>
                            {dispute.seller_responded_at ? (
                              <Badge variant="outline" className="bg-green-500/10">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Responded
                              </Badge>
                            ) : isOverdue(dispute) ? (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Overdue
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/dispute/${dispute.id}`)}
                              >
                                View
                              </Button>
                              {dispute.status === 'open' && (
                                <Button
                                  size="sm"
                                  onClick={() => startMediation.mutate(dispute.id)}
                                  disabled={startMediation.isPending}
                                >
                                  Mediate
                                </Button>
                              )}
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

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Dispute Settings
                </CardTitle>
                <CardDescription>Configure dispute timeframes and policies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dispute Window (Days)</label>
                    <p className="text-xs text-muted-foreground">
                      Days after purchase a buyer can open a dispute
                    </p>
                    <Input
                      type="number"
                      defaultValue={settings?.dispute_window_days || 7}
                      onBlur={(e) => updateSettings.mutate({ 
                        key: 'dispute_window_days', 
                        value: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Seller Response (Days)</label>
                    <p className="text-xs text-muted-foreground">
                      Days seller has to respond to a dispute
                    </p>
                    <Input
                      type="number"
                      defaultValue={settings?.seller_response_days || 7}
                      onBlur={(e) => updateSettings.mutate({ 
                        key: 'seller_response_days', 
                        value: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Guarantee Period (Months)</label>
                    <p className="text-xs text-muted-foreground">
                      Seller guarantee period for digital products
                    </p>
                    <Input
                      type="number"
                      defaultValue={settings?.guarantee_months || 6}
                      onBlur={(e) => updateSettings.mutate({ 
                        key: 'guarantee_months', 
                        value: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
