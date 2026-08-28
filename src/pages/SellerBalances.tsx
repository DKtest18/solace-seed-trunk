import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Lock, Clock, TrendingUp } from "lucide-react";
import { useSellerBalance, useSellerLedger, useSellerOrders } from "@/hooks/useSellerBalance";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useHasRole } from "@/hooks/useUserRole";
import { formatDistanceToNow } from "date-fns";
import { HourglassLoader } from '@/components/HourglassLoader';

export default function SellerBalances() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const { data: balance, isLoading: balanceLoading } = useSellerBalance();
  const { data: ledger, isLoading: ledgerLoading } = useSellerLedger();
  const { data: orders, isLoading: ordersLoading } = useSellerOrders();

  if (roleLoading || balanceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <HourglassLoader size={96} />
      </div>
    );
  }

  if (!isSeller && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'held':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'debit':
        return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Seller Balances</h1>
          <p className="text-muted-foreground">
            Track your earnings and pending payments
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Held Balance</CardTitle>
              <Lock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(Number(balance?.held_balance || 0))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Funds held until delivery confirmed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(Number(balance?.available_balance || 0))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ready for withdrawal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(Number(balance?.pending_balance || 0))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting payment confirmation
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Orders with payment status</CardDescription>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="flex justify-center py-8">
                <HourglassLoader size={64} />
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order: any) => {
                  const payment = order.payments?.[0];
                  return (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{order.products?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.profiles?.full_name || 'Unknown buyer'} • {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(Number(order.price))}</p>
                          {payment && (
                            <Badge variant={getStatusColor(payment.hold_status)} className="text-xs">
                              {payment.hold_status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No orders yet</p>
            )}
          </CardContent>
        </Card>

        {/* Ledger Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your recent ledger entries</CardDescription>
          </CardHeader>
          <CardContent>
            {ledgerLoading ? (
              <div className="flex justify-center py-8">
                <HourglassLoader size={64} />
              </div>
            ) : ledger && ledger.length > 0 ? (
              <div className="space-y-3">
                {ledger.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(entry.type)}
                      <div>
                        <p className="font-medium text-sm">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className={`font-bold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.type === 'credit' ? '+' : '-'}{formatCurrency(Math.abs(Number(entry.amount)))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
