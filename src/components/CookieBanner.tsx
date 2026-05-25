import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface CookiePreferences {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
  version?: string;
}

export const COOKIE_CONSENT_KEY = "cookie-consent-preferences";
export const COOKIE_POLICY_VERSION = "2026-05-25";

export function getCookiePreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function savePreferences(prefs: CookiePreferences) {
  const full: CookiePreferences = {
    ...prefs,
    necessary: true,
    timestamp: new Date().toISOString(),
    version: COOKIE_POLICY_VERSION,
  };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(full));
  setCookie(COOKIE_CONSENT_KEY, JSON.stringify(full), 730);
  window.dispatchEvent(new CustomEvent("cookie-consent-updated", { detail: full }));
}

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    necessary: true,
    functional: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const existing = getCookiePreferences();
    if (!existing || existing.version !== COOKIE_POLICY_VERSION) {
      setShow(true);
    }
  }, []);

  const handleAcceptAll = () => {
    savePreferences({ necessary: true, functional: true, analytics: true, marketing: false });
    setShow(false);
    setShowModal(false);
  };

  const handleRejectAll = () => {
    savePreferences({ necessary: true, functional: false, analytics: false, marketing: false });
    setShow(false);
    setShowModal(false);
  };

  const handleSave = () => {
    savePreferences(prefs);
    setShow(false);
    setShowModal(false);
  };

  if (!show) return null;

  return (
    <>
      <div
        role="dialog"
        aria-label="Cookie consent"
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-2xl p-6 md:p-8 animate-in slide-in-from-bottom"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div className="flex-1">
            <h2 className="font-semibold text-base mb-1">We use cookies.</h2>
            <p className="text-sm text-muted-foreground">
              We use strictly necessary cookies to make the marketplace work. With your consent, we would also like to use functional cookies to remember your preferences. We do not use marketing or tracking cookies.{" "}
              <Link to="/cookies" className="text-primary underline">
                Cookie policy
              </Link>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:shrink-0">
            <Button variant="outline" onClick={handleRejectAll}>
              Reject all
            </Button>
            <Button variant="outline" onClick={() => setShowModal(true)}>
              Customize
            </Button>
            <Button onClick={handleAcceptAll}>Accept all</Button>
          </div>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Choose which cookies you allow. Strictly necessary cookies are always on.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <PrefRow
              label="Strictly Necessary"
              description="Required for login, security and payments. Always active."
              checked
              disabled
            />
            <PrefRow
              label="Functional"
              description="Remember language and theme preferences."
              checked={prefs.functional}
              onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))}
            />
            <PrefRow
              label="Analytics"
              description="Help us understand how the marketplace is used. Currently none active."
              checked={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />
            <PrefRow
              label="Marketing"
              description="Not used on DK AI Marketplace."
              checked={false}
              disabled
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleAcceptAll}>
              Accept all
            </Button>
            <Button onClick={handleSave}>Save preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PrefRow({
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
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className={disabled ? "opacity-50" : ""}
      />
    </div>
  );
}
