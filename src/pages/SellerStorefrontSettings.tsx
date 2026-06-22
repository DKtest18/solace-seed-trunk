import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { SellerSidebar } from "@/components/SellerSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/dkaiDb";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Palette } from "lucide-react";

export default function SellerStorefrontSettings() {
  const { user } = useAuth();
  const [bannerUrl, setBannerUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [tagline, setTagline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await db
        .from("dkai_storefront_settings")
        .select("*")
        .eq("seller_id", user.id)
        .maybeSingle();
      if (data) {
        setBannerUrl(data.banner_url ?? "");
        setAccentColor(data.accent_color ?? "#2563eb");
        setTagline(data.tagline ?? "");
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await db.from("dkai_storefront_settings").upsert({
      seller_id: user.id,
      banner_url: bannerUrl || null,
      accent_color: accentColor,
      tagline: tagline || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Storefront updated");
  };

  return (
    <AppLayout>
      <SidebarProvider>
        <div className="flex w-full">
          <SellerSidebar />
          <main className="flex-1 p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Palette className="w-7 h-7 text-blue-600" />
              <h1 className="text-3xl font-bold">Storefront customization</h1>
            </div>
            <Card>
              <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Banner image URL</Label>
                  <Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <Label>Accent color</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-20 h-10 p-1" />
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Tagline / short bio</Label>
                  <Textarea value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} rows={3} />
                </div>
                <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </SidebarProvider>
    </AppLayout>
  );
}
