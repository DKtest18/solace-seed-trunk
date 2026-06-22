import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { SellerSidebar } from "@/components/SellerSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/dkaiDb";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Tag } from "lucide-react";

export default function SellerCoupons() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: coupons, refetch } = useQuery({
    queryKey: ["seller-coupons", user?.id],
    queryFn: async () => {
      const { data } = await db.from("dkai_coupons").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const createCoupon = async () => {
    if (!user) return;
    if (!code.trim() || !discountValue) {
      toast.error("Code and discount value are required");
      return;
    }
    setSaving(true);
    const { error } = await db.from("dkai_coupons").insert({
      seller_id: user.id,
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: Number(discountValue),
      usage_limit: usageLimit ? Number(usageLimit) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      active: true,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Coupon created");
    setCode("");
    setDiscountValue("10");
    setUsageLimit("");
    setExpiresAt("");
    refetch();
  };

  const deleteCoupon = async (id: string) => {
    const { error } = await db.from("dkai_coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Coupon deleted");
    refetch();
  };

  return (
    <AppLayout>
      <SidebarProvider>
        <div className="flex w-full">
          <SellerSidebar />
          <main className="flex-1 p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Tag className="w-7 h-7 text-blue-600" />
              <h1 className="text-3xl font-bold">Coupons & Discounts</h1>
            </div>
            <p className="text-slate-600 mb-6">
              Create promo codes for your products. Free for all sellers.
            </p>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Create a new coupon</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Code *</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUMMER20" />
                </div>
                <div>
                  <Label>Type *</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed amount (CHF)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Value *</Label>
                  <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                </div>
                <div>
                  <Label>Usage limit (optional)</Label>
                  <Input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" />
                </div>
                <div className="md:col-span-2">
                  <Label>Expires at (optional)</Label>
                  <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={createCoupon} disabled={saving}>
                    {saving ? "Creating..." : "Create coupon"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <h2 className="text-xl font-semibold mb-3">Your coupons</h2>
            <div className="grid gap-3">
              {(coupons ?? []).map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-mono font-bold text-lg">{c.code}</div>
                      <div className="text-sm text-slate-600">
                        {c.discount_type === "percent" ? `${c.discount_value}% off` : `CHF ${c.discount_value} off`}
                        {c.usage_limit ? ` • used ${c.times_redeemed ?? 0} / ${c.usage_limit}` : ""}
                        {c.expires_at ? ` • expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => deleteCoupon(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(coupons ?? []).length === 0 && (
                <p className="text-slate-500">No coupons yet.</p>
              )}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </AppLayout>
  );
}
