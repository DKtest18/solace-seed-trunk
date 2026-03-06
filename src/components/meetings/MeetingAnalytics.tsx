import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Video,
  Phone
} from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface AnalyticsData {
  totalMeetings: number;
  paidMeetings: number;
  freeMeetings: number;
  groupMeetings: number;
  totalRevenue: number;
  totalDuration: number;
  requestsReceived: number;
  requestsAccepted: number;
  requestsDeclined: number;
  cancellations: number;
  conversionRate: number;
  avgDuration: number;
  dailyData: {
    date: string;
    meetings: number;
    revenue: number;
  }[];
  meetingTypeDistribution: {
    name: string;
    value: number;
  }[];
}

export function MeetingAnalytics() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['meeting-analytics', user?.id, timeRange],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!user) throw new Error('Not authenticated');

      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');

      // Fetch aggregated analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('meeting_analytics')
        .select('*')
        .eq('seller_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (analyticsError) throw analyticsError;

      // Fetch meetings for type distribution
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select(`
          id,
          meeting_type:meeting_types(name, is_paid, is_group),
          duration_minutes,
          status
        `)
        .eq('seller_id', user.id)
        .gte('meeting_date', startDate);

      if (meetingsError) throw meetingsError;

      // Fetch meeting requests
      const { data: requests, error: requestsError } = await supabase
        .from('meeting_requests')
        .select('status')
        .eq('seller_id', user.id)
        .gte('created_at', startOfDay(subDays(new Date(), days)).toISOString());

      if (requestsError) throw requestsError;

      // Fetch meeting payments
      const { data: payments, error: paymentsError } = await supabase
        .from('meeting_payments')
        .select('seller_earnings')
        .eq('seller_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', startOfDay(subDays(new Date(), days)).toISOString());

      if (paymentsError) throw paymentsError;

      // Calculate totals
      const totalMeetings = meetings?.length || 0;
      const paidMeetings = meetings?.filter(m => (m.meeting_type as any)?.is_paid).length || 0;
      const freeMeetings = totalMeetings - paidMeetings;
      const groupMeetings = meetings?.filter(m => (m.meeting_type as any)?.is_group).length || 0;
      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.seller_earnings || 0), 0) || 0;
      const totalDuration = meetings?.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) || 0;
      
      const requestsReceived = requests?.length || 0;
      const requestsAccepted = requests?.filter(r => r.status === 'accepted').length || 0;
      const requestsDeclined = requests?.filter(r => r.status === 'declined').length || 0;
      const cancellations = meetings?.filter(m => m.status === 'cancelled').length || 0;
      
      const conversionRate = requestsReceived > 0 ? (requestsAccepted / requestsReceived) * 100 : 0;
      const avgDuration = totalMeetings > 0 ? totalDuration / totalMeetings : 0;

      // Build daily data
      const dailyData: { date: string; meetings: number; revenue: number }[] = [];
      for (let i = days; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const dayAnalytics = analyticsData?.find(a => a.date === date);
        dailyData.push({
          date: format(subDays(new Date(), i), 'MMM dd'),
          meetings: dayAnalytics?.total_meetings || 0,
          revenue: Number(dayAnalytics?.total_revenue || 0)
        });
      }

      // Meeting type distribution
      const typeCount: Record<string, number> = {};
      meetings?.forEach(m => {
        const typeName = (m.meeting_type as any)?.name || 'Unknown';
        typeCount[typeName] = (typeCount[typeName] || 0) + 1;
      });
      const meetingTypeDistribution = Object.entries(typeCount).map(([name, value]) => ({
        name,
        value
      }));

      return {
        totalMeetings,
        paidMeetings,
        freeMeetings,
        groupMeetings,
        totalRevenue,
        totalDuration,
        requestsReceived,
        requestsAccepted,
        requestsDeclined,
        cancellations,
        conversionRate,
        avgDuration,
        dailyData,
        meetingTypeDistribution
      };
    },
    enabled: !!user
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Meeting Analytics</h2>
        <Select value={timeRange} onValueChange={(v: '7d' | '30d' | '90d') => setTimeRange(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalMeetings}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <Video className="h-3 w-3 mr-1" />
                {analytics.paidMeetings} paid
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {analytics.freeMeetings} free
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {analytics.paidMeetings} paid meetings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.conversionRate.toFixed(1)}%</div>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {analytics.requestsAccepted} accepted
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-destructive" />
                {analytics.requestsDeclined} declined
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analytics.avgDuration)} min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {Math.round(analytics.totalDuration / 60)} hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meetings Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Meetings Over Time</CardTitle>
            <CardDescription>Daily meeting count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="meetings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue from paid meetings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Meeting Type Distribution */}
        {analytics.meetingTypeDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Meeting Types</CardTitle>
              <CardDescription>Distribution by meeting type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.meetingTypeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {analytics.meetingTypeDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Request Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Request Statistics</CardTitle>
            <CardDescription>Meeting request breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Requests</span>
                <span className="font-semibold">{analytics.requestsReceived}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Accepted
                </span>
                <span className="font-semibold text-green-500">{analytics.requestsAccepted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Declined
                </span>
                <span className="font-semibold text-destructive">{analytics.requestsDeclined}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cancellations</span>
                <span className="font-semibold">{analytics.cancellations}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Group Meetings
                </span>
                <span className="font-semibold">{analytics.groupMeetings}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}