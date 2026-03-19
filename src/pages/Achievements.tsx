import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/dkaiDb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock, Star, Crown, Medal, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { useHasRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/AppLayout';
import { Progress } from "@/components/ui/progress";

interface Achievement {
  id: string;
  achievement_name: string;
  achievement_description: string;
  sales_count: number;
  unlocked_at: string;
}

const MILESTONES = [
  { count: 1, name: "First Sale!", description: "Congratulations on your first sale!", icon: "🎉" },
  { count: 10, name: "Rising Seller!", description: "You've made 10 sales!", icon: "🚀" },
  { count: 100, name: "Top Seller!", description: "100 sales achieved!", icon: "⭐" },
  { count: 1000, name: "Elite Seller!", description: "1000 sales - you're elite!", icon: "👑" },
  { count: 10000, name: "Marketplace Legend!", description: "10,000 sales - legendary status!", icon: "🏆" },
];

const RANKS = [
  { minSales: 0, minRating: 0, name: "Newcomer", icon: Star, color: "text-muted-foreground", bgColor: "bg-muted" },
  { minSales: 1, minRating: 0, name: "Starter", icon: Star, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { minSales: 5, minRating: 3.0, name: "Bronze Seller", icon: Medal, color: "text-amber-700", bgColor: "bg-amber-700/10" },
  { minSales: 25, minRating: 3.5, name: "Silver Seller", icon: Medal, color: "text-gray-400", bgColor: "bg-gray-400/10" },
  { minSales: 50, minRating: 4.0, name: "Gold Seller", icon: Trophy, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  { minSales: 100, minRating: 4.2, name: "Platinum Seller", icon: Trophy, color: "text-cyan-400", bgColor: "bg-cyan-400/10" },
  { minSales: 250, minRating: 4.5, name: "Diamond Seller", icon: Crown, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { minSales: 500, minRating: 4.7, name: "Master Seller", icon: Crown, color: "text-red-500", bgColor: "bg-red-500/10" },
  { minSales: 1000, minRating: 4.8, name: "Legendary", icon: Crown, color: "text-primary", bgColor: "bg-primary/10" },
];

function getRank(totalSales: number, avgRating: number) {
  let currentRank = RANKS[0];
  for (const rank of RANKS) {
    if (totalSales >= rank.minSales && avgRating >= rank.minRating) {
      currentRank = rank;
    }
  }
  return currentRank;
}

function getNextRank(totalSales: number, avgRating: number) {
  for (const rank of RANKS) {
    if (totalSales < rank.minSales || avgRating < rank.minRating) {
      return rank;
    }
  }
  return null;
}

export default function Achievements() {
  const { user } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch achievements
      const { data: achData } = await supabase
        .from("seller_achievements")
        .select("*")
        .eq("seller_id", user?.id)
        .order("unlocked_at", { ascending: false });

      setAchievements(achData || []);

      // Fetch total sales count
      const { data: products } = await db
        .from('dkai_products')
        .select('id')
        .eq('seller_id', user?.id);
      
      const productIds = products?.map((p: any) => p.id) || [];
      
      if (productIds.length > 0) {
        const { count } = await db
          .from('dkai_orders')
          .select('*', { count: 'exact', head: true })
          .in('product_id', productIds)
          .in('status', ['completed', 'delivered', 'payment_confirmed']);
        
        setTotalSales(count || 0);

        // Fetch average rating
        const { data: reviews } = await db
          .from('dkai_reviews')
          .select('rating')
          .in('product_id', productIds);
        
        if (reviews && reviews.length > 0) {
          const avg = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
          setAvgRating(Math.round(avg * 10) / 10);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const isUnlocked = (count: number) => achievements.some((a) => a.sales_count === count);
  const getUnlockedDate = (count: number) => achievements.find((a) => a.sales_count === count)?.unlocked_at;

  const currentRank = getRank(totalSales, avgRating);
  const nextRank = getNextRank(totalSales, avgRating);
  const RankIcon = currentRank.icon;

  const salesProgress = nextRank ? Math.min(100, (totalSales / nextRank.minSales) * 100) : 100;

  const content = (
    <div className="container max-w-6xl mx-auto py-8 px-6">
      {/* Rank Card */}
      <Card className="p-6 mb-8 border-2">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className={`p-4 rounded-2xl ${currentRank.bgColor}`}>
            <RankIcon className={`h-12 w-12 ${currentRank.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold">{currentRank.name}</h2>
              <Badge variant="outline" className="text-sm">{totalSales} sales</Badge>
              {avgRating > 0 && (
                <Badge variant="outline" className="text-sm">⭐ {avgRating} avg rating</Badge>
              )}
            </div>
            {nextRank ? (
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Progress to <strong>{nextRank.name}</strong></span>
                  <span>{totalSales} / {nextRank.minSales} sales{nextRank.minRating > 0 && ` · ${avgRating} / ${nextRank.minRating} rating`}</span>
                </div>
                <Progress value={salesProgress} className="h-2" />
              </div>
            ) : (
              <p className="text-muted-foreground mt-1">You've reached the highest rank! 🎉</p>
            )}
          </div>
        </div>
      </Card>

      {/* All Ranks Overview */}
      <h3 className="text-lg font-semibold mb-4">All Ranks</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {RANKS.map((rank) => {
          const isCurrentOrPast = totalSales >= rank.minSales && avgRating >= rank.minRating;
          const Icon = rank.icon;
          return (
            <div
              key={rank.name}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isCurrentOrPast ? 'border-primary/30 bg-card' : 'opacity-50 grayscale'
              } ${currentRank.name === rank.name ? 'ring-2 ring-primary' : ''}`}
            >
              <Icon className={`h-6 w-6 ${isCurrentOrPast ? rank.color : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">{rank.name}</p>
                <p className="text-xs text-muted-foreground">{rank.minSales}+ sales · {rank.minRating}+ rating</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Achievement Milestones */}
      <h3 className="text-lg font-semibold mb-4">Sales Milestones</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MILESTONES.map((milestone) => {
          const unlocked = isUnlocked(milestone.count);
          const unlockedDate = getUnlockedDate(milestone.count);

          return (
            <Card
              key={milestone.count}
              className={`p-6 transition-all ${
                unlocked
                  ? "border-primary bg-primary/5"
                  : "opacity-60 grayscale"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{milestone.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{milestone.name}</h3>
                    {!unlocked && <Lock className="w-4 h-4" />}
                    {unlocked && <Trophy className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {milestone.description}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {unlocked ? (
                      <>
                        Unlocked on{" "}
                        {unlockedDate &&
                          format(new Date(unlockedDate), "MMM d, yyyy")}
                      </>
                    ) : (
                      `Reach ${milestone.count} sales to unlock`
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {achievements.length === 0 && !loading && (
        <Card className="p-12 text-center mt-6">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No Achievements Yet</h3>
          <p className="text-muted-foreground">
            Start selling to unlock your first achievement!
          </p>
        </Card>
      )}
    </div>
  );

  if (isSeller || isAdmin) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <SellerSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-6 sticky top-0 z-10">
              <SidebarTrigger className="mr-4" />
              <h1 className="text-xl font-bold">Achievements</h1>
            </header>
            <main className="flex-1 overflow-auto">
              {content}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <AppLayout>
      {content}
    </AppLayout>
  );
}
