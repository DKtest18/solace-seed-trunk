import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Eye, Users, CheckCircle, CreditCard, TrendingUp, DollarSign, Percent, Calendar } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

type TimeRange = '7d' | '30d' | '90d';

export default function SellerAnalytics() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [source, setSource] = useState<string>('all');

  const getDateRange = (range: TimeRange) => {
    const end = endOfDay(new Date());
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const start = startOfDay(subDays(new Date(), days));
    return { start, end };
  };

  const { start, end } = getDateRange(timeRange);

  interface AnalyticsSummary {
    page_views: number;
    requests_created: number;
    meetings_confirmed: number;
    meetings_paid: number;
    meetings_canceled: number;
    meetings_completed: number;
    revenue_gross: number;
    revenue_net: number;
    conversion_view_to_request: number;
    conversion_request_to_confirmed: number;
    conversion_confirmed_to_paid: number;
  }

  // Fetch analytics summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['seller-analytics-summary', user?.id, timeRange, source],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc('get_seller_analytics_summary', {
        p_seller_id: user.id,
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
        p_source: source === 'all' ? null : source
      });
      
      if (error) throw error;
      return data as unknown as AnalyticsSummary | null;
    },
    enabled: !!user?.id
  });

  // Fetch daily analytics
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['seller-analytics-daily', user?.id, timeRange],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase.rpc('get_seller_analytics_daily', {
        p_seller_id: user.id,
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString()
      });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Fetch top meeting types
  const { data: topMeetingTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['seller-top-meeting-types', user?.id, timeRange],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase.rpc('get_seller_top_meeting_types', {
        p_seller_id: user.id,
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
        p_limit: 5
      });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const chartData = dailyData?.map((d: any) => ({
    date: format(new Date(d.date), 'MMM d'),
    views: Number(d.page_views) || 0,
    requests: Number(d.requests) || 0,
    confirmed: Number(d.confirmed) || 0,
    paid: Number(d.paid) || 0,
    revenue: Number(d.revenue_gross) || 0
  })) || [];

  const kpiCards = [
    {
      title: 'Page Views',
      value: summary?.page_views || 0,
      icon: Eye,
      color: 'text-blue-500'
    },
    {
      title: 'Requests Created',
      value: summary?.requests_created || 0,
      icon: Users,
      color: 'text-purple-500'
    },
    {
      title: 'Meetings Confirmed',
      value: summary?.meetings_confirmed || 0,
      icon: CheckCircle,
      color: 'text-green-500'
    },
    {
      title: 'Meetings Paid',
      value: summary?.meetings_paid || 0,
      icon: CreditCard,
      color: 'text-orange-500'
    },
    {
      title: 'Revenue (Gross)',
      value: `€${((summary?.revenue_gross || 0) / 100).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-emerald-500'
    },
    {
      title: 'Revenue (Net)',
      value: `€${((summary?.revenue_net || 0) / 100).toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-teal-500'
    }
  ];

  const conversionCards = [
    {
      title: 'View → Request',
      value: `${summary?.conversion_view_to_request || 0}%`,
      icon: Percent
    },
    {
      title: 'Request → Confirmed',
      value: `${summary?.conversion_request_to_confirmed || 0}%`,
      icon: Percent
    },
    {
      title: 'Confirmed → Paid',
      value: `${summary?.conversion_confirmed_to_paid || 0}%`,
      icon: Percent
    }
  ];

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Please log in to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your meeting bookings and revenue</p>
        </div>
        
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          kpiCards.map((kpi, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  <span className="text-sm">{kpi.title}</span>
                </div>
                <p className="text-2xl font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Conversion Rates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {conversionCards.map((card, i) => (
          <Card key={i}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
              <card.icon className="h-8 w-8 text-muted-foreground/30" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Daily Activity</CardTitle>
              <CardDescription>Page views and meeting requests over time</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="views" fill="hsl(var(--primary))" name="Page Views" />
                    <Bar dataKey="requests" fill="hsl(var(--secondary))" name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel">
          <Card>
            <CardHeader>
              <CardTitle>Booking Funnel</CardTitle>
              <CardDescription>Conversion through each stage</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="requests" fill="hsl(217, 91%, 60%)" name="Requests" />
                    <Bar dataKey="confirmed" fill="hsl(142, 76%, 36%)" name="Confirmed" />
                    <Bar dataKey="paid" fill="hsl(38, 92%, 50%)" name="Paid" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
              <CardDescription>Daily gross revenue from paid meetings</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `€${v}`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`€${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Meeting Types */}
      <Card>
        <CardHeader>
          <CardTitle>Top Meeting Types</CardTitle>
          <CardDescription>Your most popular meeting types by bookings</CardDescription>
        </CardHeader>
        <CardContent>
          {typesLoading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : topMeetingTypes && topMeetingTypes.length > 0 ? (
            <div className="space-y-3">
              {topMeetingTypes.map((type: any, i: number) => (
                <div key={type.meeting_type_id || i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="font-medium">{type.meeting_type_name || 'Unknown Type'}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{type.bookings} bookings</p>
                    <p className="text-sm text-muted-foreground">€{((type.revenue || 0) / 100).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No meeting data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
