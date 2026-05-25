import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  CookiePreferences,
  getCookiePreferences,
  savePreferences,
} from "@/components/CookieBanner";
import { Link } from "react-router-dom";

const DEFAULTS: CookiePreferences = {
  necessary: true,
  functional: true,
  analytics: false,
  marketing: false,
};

export default function CookieSettings() {
  const [prefs, setPrefs] = useState<CookiePreferences>(DEFAULTS);

  useEffect(() => {
    const existing = getCookiePreferences();
    if (existing) setPrefs({ ...DEFAULTS, ...existing, necessary: true });
  }, []);

  const handleSave = () => {
    savePreferences(prefs);
    toast({ title: "Preferences saved", description: "Your cookie choices have been updated." });
  };

  const handleReset = () => {
    setPrefs(DEFAULTS);
    savePreferences(DEFAULTS);
    toast({ title: "Reset to defaults" });
  };

  return (
    <main className="max-w-3xl mx-auto py-12 px-6">
      <h1 className="font-display text-4xl font-semibold mb-2">Cookie settings</h1>
      <p className="text-muted-foreground mb-8">
        Manage how DK AI Marketplace uses cookies on your device. See our{" "}
        <Link to="/cookies" className="text-primary underline">
          Cookie policy
        </Link>{" "}
        for details.
      </p>

      <div className="space-y-6 border border-border rounded-lg p-6">
        <Row label="Strictly Necessary" description="Required for login, security and payments. Always active." checked disabled />
        <Row
          label="Functional"
          description="Remember language and theme preferences."
          checked={prefs.functional}
          onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))}
        />
        <Row
          label="Analytics"
          description="Help us understand how the marketplace is used. Currently none active."
          checked={prefs.analytics}
          onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
        />
        <Row label="Marketing" description="Not used on DK AI Marketplace." checked={false} disabled />
      </div>

      <div className="flex gap-2 mt-6">
        <Button onClick={handleSave}>Save changes</Button>
        <Button variant="outline" onClick={handleReset}>
          Reset to defaults
        </Button>
      </div>
    </main>
  );
}

function Row({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} className={disabled ? "opacity-50" : ""} />
    </div>
  );
}
