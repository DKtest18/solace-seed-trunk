import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy, Lock } from "lucide-react";
import { format } from "date-fns";

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

export default function Achievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAchievements();
    }
  }, [user]);

  const fetchAchievements = async () => {
    try {
      const { data, error } = await supabase
        .from("seller_achievements")
        .select("*")
        .eq("seller_id", user?.id)
        .order("unlocked_at", { ascending: false });

      if (error) throw error;
      setAchievements(data || []);
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  const isUnlocked = (count: number) => {
    return achievements.some((a) => a.sales_count === count);
  };

  const getUnlockedDate = (count: number) => {
    const achievement = achievements.find((a) => a.sales_count === count);
    return achievement?.unlocked_at;
  };

  return (
    <AppLayout>
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Achievements</h1>
          <p className="text-muted-foreground">
            Unlock trophies as you reach sales milestones
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
          <Card className="p-12 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Achievements Yet</h3>
            <p className="text-muted-foreground">
              Start selling to unlock your first achievement!
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
