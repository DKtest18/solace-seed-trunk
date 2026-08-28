import { HourglassLoader } from '@/components/HourglassLoader';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Calendar, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
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
} from "@/components/ui/alert-dialog";

export default function MySubscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['my-subscriptions', user?.id],
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
          subscription_payments (
            id,
            amount,
            status,
            paid_at,
            failure_message,
            created_at
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const manageMutation = useMutation({
    mutationFn: async ({ subscriptionId, action }: { subscriptionId: string; action: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { subscriptionId, action }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        toast({
          title: t('subscriptions.actionSuccess'),
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      }
    },
    onError: (error: any) => {
      toast({
        title: t('subscriptions.actionError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

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
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
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
          <h1 className="text-3xl font-bold">{t('subscriptions.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('subscriptions.description')}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <HourglassLoader size={96} />
          </div>
        ) : subscriptions && subscriptions.length > 0 ? (
          <div className="grid gap-6">
            {subscriptions.map((subscription: any) => (
              <Card key={subscription.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {subscription.products?.image_url && (
                        <img
                          src={subscription.products.image_url}
                          alt={subscription.products.title}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <CardTitle className="text-xl">{subscription.products?.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <CreditCard className="h-4 w-4" />
                          ${subscription.products?.price?.toFixed(2)}/month
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(subscription.status, subscription.cancel_at_period_end)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground">{t('subscriptions.startDate')}</div>
                      <div className="font-medium">
                        {format(new Date(subscription.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground">{t('subscriptions.currentPeriod')}</div>
                      <div className="font-medium">
                        {subscription.current_period_end 
                          ? format(new Date(subscription.current_period_end), 'MMM d, yyyy')
                          : '-'}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground">{t('subscriptions.nextBilling')}</div>
                      <div className="font-medium flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {subscription.cancel_at_period_end 
                          ? 'Will not renew'
                          : subscription.current_period_end 
                            ? format(new Date(subscription.current_period_end), 'MMM d, yyyy')
                            : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Payment History */}
                  {subscription.subscription_payments && subscription.subscription_payments.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-medium mb-3">{t('subscriptions.paymentHistory')}</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {subscription.subscription_payments.slice(0, 5).map((payment: any) => (
                          <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                            <div className="flex items-center gap-3">
                              {payment.status === 'paid' ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span>${payment.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {payment.failure_message && (
                                <span className="text-destructive text-xs">{payment.failure_message}</span>
                              )}
                              <span className="text-muted-foreground">
                                {payment.paid_at 
                                  ? format(new Date(payment.paid_at), 'MMM d, yyyy')
                                  : format(new Date(payment.created_at), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={() => manageMutation.mutate({ subscriptionId: subscription.id, action: 'portal' })}
                      disabled={manageMutation.isPending}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {t('subscriptions.managePayment')}
                    </Button>

                    {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="text-destructive hover:text-destructive">
                            {t('subscriptions.cancelSubscription')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('subscriptions.cancelConfirmTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('subscriptions.cancelConfirmDescription')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => manageMutation.mutate({ subscriptionId: subscription.id, action: 'cancel' })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('subscriptions.confirmCancel')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {subscription.cancel_at_period_end && subscription.status === 'active' && (
                      <Button
                        variant="default"
                        onClick={() => manageMutation.mutate({ subscriptionId: subscription.id, action: 'resume' })}
                        disabled={manageMutation.isPending}
                      >
                        {t('subscriptions.resumeSubscription')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('subscriptions.noSubscriptions')}</h3>
              <p className="text-muted-foreground mb-4">{t('subscriptions.noSubscriptionsDescription')}</p>
              <Button onClick={() => navigate('/marketplace')}>
                {t('subscriptions.browseProducts')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
