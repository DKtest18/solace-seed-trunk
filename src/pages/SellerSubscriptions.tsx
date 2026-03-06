import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SellerSubscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['seller-subscriptions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          products:product_id (
            id,
            title,
            image_url,
            price
          ),
          profiles:user_id (
            id,
            username,
            avatar_url,
            full_name
          ),
          subscription_payments (
            id,
            amount,
            status,
            seller_earnings,
            platform_fee,
            paid_at,
            failure_message,
            created_at
          )
        `)
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate stats
  const stats = {
    totalSubscribers: subscriptions?.filter(s => s.status === 'active').length || 0,
    totalRevenue: subscriptions?.reduce((acc, s) => {
      return acc + (s.subscription_payments?.reduce((sum: number, p: any) => 
        p.status === 'paid' ? sum + (p.seller_earnings || 0) : sum, 0) || 0);
    }, 0) || 0,
    monthlyRevenue: subscriptions?.reduce((acc, s) => {
      if (s.status === 'active' && s.products?.price) {
        return acc + (s.products.price * 0.9);
      }
      return acc;
    }, 0) || 0,
    pastDueCount: subscriptions?.filter(s => s.status === 'past_due').length || 0,
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Canceling</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'past_due':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Canceled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('sellerSubscriptions.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('sellerSubscriptions.description')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('sellerSubscriptions.activeSubscribers')}</p>
                  <p className="text-2xl font-bold">{stats.totalSubscribers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-500/10">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('sellerSubscriptions.monthlyRevenue')}</p>
                  <p className="text-2xl font-bold">${stats.monthlyRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('sellerSubscriptions.totalEarnings')}</p>
                  <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full ${stats.pastDueCount > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
                  <AlertTriangle className={`h-5 w-5 ${stats.pastDueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('sellerSubscriptions.pastDue')}</p>
                  <p className="text-2xl font-bold">{stats.pastDueCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : subscriptions && subscriptions.length > 0 ? (
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Active ({subscriptions.filter(s => s.status === 'active').length})</TabsTrigger>
              <TabsTrigger value="past_due">Past Due ({subscriptions.filter(s => s.status === 'past_due').length})</TabsTrigger>
              <TabsTrigger value="canceled">Canceled ({subscriptions.filter(s => s.status === 'canceled').length})</TabsTrigger>
              <TabsTrigger value="all">All ({subscriptions.length})</TabsTrigger>
            </TabsList>

            {['active', 'past_due', 'canceled', 'all'].map(tab => (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('sellerSubscriptions.subscriber')}</TableHead>
                          <TableHead>{t('sellerSubscriptions.product')}</TableHead>
                          <TableHead>{t('sellerSubscriptions.status')}</TableHead>
                          <TableHead>{t('sellerSubscriptions.nextBilling')}</TableHead>
                          <TableHead>{t('sellerSubscriptions.monthlyAmount')}</TableHead>
                          <TableHead>{t('sellerSubscriptions.started')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions
                          .filter(s => tab === 'all' || s.status === tab)
                          .map((subscription: any) => (
                            <TableRow key={subscription.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={subscription.profiles?.avatar_url} />
                                    <AvatarFallback>
                                      {subscription.profiles?.username?.[0]?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{subscription.profiles?.full_name || subscription.profiles?.username}</p>
                                    <p className="text-xs text-muted-foreground">@{subscription.profiles?.username}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {subscription.products?.image_url && (
                                    <img
                                      src={subscription.products.image_url}
                                      alt=""
                                      className="w-8 h-8 rounded object-cover"
                                    />
                                  )}
                                  <span className="font-medium">{subscription.products?.title}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(subscription.status, subscription.cancel_at_period_end)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3" />
                                  {subscription.cancel_at_period_end 
                                    ? 'Ends: ' + (subscription.current_period_end ? format(new Date(subscription.current_period_end), 'MMM d') : '-')
                                    : subscription.current_period_end 
                                      ? format(new Date(subscription.current_period_end), 'MMM d, yyyy')
                                      : '-'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium text-green-600">
                                  ${((subscription.products?.price || 0) * 0.9).toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1">/mo</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {format(new Date(subscription.created_at), 'MMM d, yyyy')}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('sellerSubscriptions.noSubscribers')}</h3>
              <p className="text-muted-foreground mb-4">{t('sellerSubscriptions.noSubscribersDescription')}</p>
              <Button onClick={() => navigate('/create-product')}>
                {t('sellerSubscriptions.createProduct')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
