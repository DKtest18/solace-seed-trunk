import { useQuery } from '@tanstack/react-query';
import { externalSupabase } from '@/lib/externalSupabase';
import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { format, subDays, parseISO, startOfDay } from 'date-fns';
import { 
  Video, 
  DollarSign, 
  Clock, 
  Users, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Calendar
} from 'lucide-react';

export default function AdminMeetingAnalytics() {
  // Fetch all DK meetings for analytics from dk_meetings2
  const { data: meetings, isLoading } = useQuery({
    queryKey: ['admin-dk-meetings-analytics'],
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .from('dk_meetings2')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Calculate analytics
  const analytics = meetings ? {
    totalMeetings: meetings.length,
    completedMeetings: meetings.filter(m => m.status === 'ended').length,
    activeMeetings: meetings.filter(m => m.status === 'active').length,
    pendingMeetings: meetings.filter(m => m.status === 'pending').length,
    acceptedMeetings: meetings.filter(m => m.status === 'accepted').length,
    declinedMeetings: meetings.filter(m => m.status === 'declined').length,
    paidMeetings: 0, // dk_meetings2 doesn't have payment fields
    freeMeetings: meetings.length,
    totalRevenue: 0,
    totalExtensions: 0,
    disputeCount: 0,
    avgDuration: meetings.length > 0 ? 
      meetings.reduce((sum, m) => {
        if (m.start_time && m.end_time) {
          const start = new Date(m.start_time);
          const end = new Date(m.end_time);
          return sum + (end.getTime() - start.getTime()) / 60000;
        }
        return sum;
      }, 0) / meetings.length : 0
  } : null;

  // Status distribution for pie chart
  const statusData = analytics ? [
    { name: 'Completed', value: analytics.completedMeetings, color: 'hsl(var(--primary))' },
    { name: 'Accepted', value: analytics.acceptedMeetings, color: 'hsl(var(--chart-2))' },
    { name: 'Pending', value: analytics.pendingMeetings, color: 'hsl(var(--chart-3))' },
    { name: 'Declined', value: analytics.declinedMeetings, color: 'hsl(var(--destructive))' }
  ].filter(d => d.value > 0) : [];

  // Daily meetings for line chart (last 30 days)
  const dailyData = meetings ? (() => {
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      days[date] = 0;
    }
    
    meetings.forEach(m => {
      const date = format(parseISO(m.created_at), 'yyyy-MM-dd');
      if (days[date] !== undefined) {
        days[date]++;
      }
    });

    return Object.entries(days).map(([date, count]) => ({
      date: format(parseISO(date), 'MMM d'),
      meetings: count
    }));
  })() : [];

  // Top sellers
  const topSellers = meetings ? (() => {
    const sellerCounts: Record<string, { name: string; count: number; revenue: number }> = {};
    
    meetings.forEach(m => {
      if (!sellerCounts[m.seller_name]) {
        sellerCounts[m.seller_name] = { name: m.seller_name, count: 0, revenue: 0 };
      }
      sellerCounts[m.seller_name].count++;
      // dk_meetings2 doesn't have payment fields
    });

    return Object.values(sellerCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  })() : [];

  if (isLoading) {
    return (
      <AdminRouteGuard>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </div>
      </AdminRouteGuard>
    );
  }

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Meeting Analytics</h1>
            <p className="text-muted-foreground">DK AI Meeting platform performance overview</p>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                <Video className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalMeetings || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.completedMeetings || 0} completed
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${analytics?.totalRevenue?.toFixed(2) || '0.00'}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.paidMeetings || 0} paid meetings
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(analytics?.avgDuration || 0)} min</div>
                <p className="text-xs text-muted-foreground">
                  +{analytics?.totalExtensions || 0} min extensions
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Disputes</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.disputeCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.totalMeetings ? ((analytics.disputeCount / analytics.totalMeetings) * 100).toFixed(1) : 0}% rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            {/* Daily Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Meetings (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="meetings" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Meeting Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Sellers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Sellers</CardTitle>
              <CardDescription>Sellers with most meetings</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSellers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Meetings" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3 mt-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Acceptance Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics?.totalMeetings ? 
                    (((analytics.acceptedMeetings + analytics.completedMeetings) / analytics.totalMeetings) * 100).toFixed(1) 
                    : 0}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Paid vs Free
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics?.paidMeetings || 0} / {analytics?.freeMeetings || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  Active Now
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.activeMeetings || 0}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
}
