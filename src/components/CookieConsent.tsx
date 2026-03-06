import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X, Settings, Cookie } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CookiePreferences {
  essential: boolean; // Always true, can't be disabled
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = "cookie-consent";
const COOKIE_PREFERENCES_KEY = "cookie-preferences";
const COOKIE_POLICY_VERSION = "2.12.2025";

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    functional: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    const savedVersion = localStorage.getItem("cookie-policy-version");
    
    // Show banner if no consent or policy version changed
    if (!consent || savedVersion !== COOKIE_POLICY_VERSION) {
      setShow(true);
    } else {
      // Load saved preferences
      const savedPrefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (savedPrefs) {
        try {
          setPreferences(JSON.parse(savedPrefs));
        } catch (e) {
          console.error("Error parsing cookie preferences:", e);
        }
      }
    }
  }, []);

  const saveConsent = (prefs: CookiePreferences, consentType: string) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, consentType);
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
    localStorage.setItem("cookie-policy-version", COOKIE_POLICY_VERSION);
    setPreferences(prefs);
    setShow(false);
    setShowSettings(false);

    // Block non-essential cookies if declined
    if (!prefs.analytics) {
      // Disable analytics tracking
      window.localStorage.removeItem("analytics-enabled");
    }
    if (!prefs.marketing) {
      // Disable marketing cookies
      window.localStorage.removeItem("marketing-enabled");
    }
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      functional: true,
      marketing: true,
    };
    saveConsent(allAccepted, "accepted-all");
  };

  const handleDecline = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      functional: false,
      marketing: false,
    };
    saveConsent(essentialOnly, "declined");
  };

  const handleSaveSettings = () => {
    saveConsent(preferences, "custom");
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-in slide-in-from-bottom">
        <Card className="max-w-4xl mx-auto p-6 shadow-lg border-2 bg-card">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">We use cookies</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We use cookies and similar technologies to enhance your experience, analyze traffic, and personalize content. 
                Essential cookies are required for the platform to function. You can customize your preferences or accept all cookies.
                Learn more in our{" "}
                <Link to="/legal/cookies" className="text-primary underline hover:no-underline">Cookie Policy</Link> and{" "}
                <Link to="/legal/privacy" className="text-primary underline hover:no-underline">Privacy Policy</Link>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleAcceptAll} className="min-w-[120px]">
                  Accept All
                </Button>
                <Button onClick={handleDecline} variant="outline" className="min-w-[120px]">
                  Decline
                </Button>
                <Button 
                  onClick={() => setShowSettings(true)} 
                  variant="ghost"
                  className="gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Cookie Settings
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDecline}
              className="shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Cookie Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cookie Settings
            </DialogTitle>
            <DialogDescription>
              Manage your cookie preferences. Essential cookies cannot be disabled as they are required for the platform to function.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Essential Cookies */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Essential Cookies</Label>
                <p className="text-sm text-muted-foreground">
                  Required for login, authentication, security, and payment processing.
                </p>
              </div>
              <Switch checked={true} disabled className="opacity-50" />
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Analytics Cookies</Label>
                <p className="text-sm text-muted-foreground">
                  Help us understand how visitors use the platform.
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, analytics: checked }))
                }
              />
            </div>

            {/* Functional Cookies */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Functional Cookies</Label>
                <p className="text-sm text-muted-foreground">
                  Remember your preferences and settings.
                </p>
              </div>
              <Switch
                checked={preferences.functional}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, functional: checked }))
                }
              />
            </div>

            {/* Marketing Cookies */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Marketing Cookies</Label>
                <p className="text-sm text-muted-foreground">
                  Used for personalized ads and referral tracking.
                </p>
              </div>
              <Switch
                checked={preferences.marketing}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, marketing: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDecline}>
              Decline All
            </Button>
            <Button onClick={handleSaveSettings}>
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
