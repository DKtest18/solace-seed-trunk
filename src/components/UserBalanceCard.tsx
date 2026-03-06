import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, TrendingUp } from "lucide-react";

export function UserBalanceCard() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
  }, [user]);

  const fetchBalance = async () => {
    try {
      const { data, error } = await supabase
        .from("user_balances")
        .select("available_balance")
        .eq("user_id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setBalance(data?.available_balance || 0);
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-6 bg-muted rounded w-24" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Platform Balance</p>
          <p className="text-2xl font-bold">${balance.toFixed(2)}</p>
        </div>
        {balance > 0 && (
          <TrendingUp className="w-5 h-5 text-green-500" />
        )}
      </div>
    </Card>
  );
}
