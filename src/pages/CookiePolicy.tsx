import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export default function CookiePolicy() {
  const today = new Date().toLocaleDateString();
  return (
    <main className="max-w-3xl mx-auto py-12 px-6">
      <Button variant="ghost" asChild className="mb-4">
        <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
      </Button>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-4xl font-semibold">Cookie Policy</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <p className="text-muted-foreground mb-8">Last updated: {today}</p>

      <article className="space-y-8 text-foreground leading-relaxed">
        <section>
          <h2 className="text-2xl font-semibold mb-2">1. What are cookies?</h2>
          <p className="text-muted-foreground">
            Cookies are small text files stored on your device when you visit a website.
            They allow us to recognise your device and improve your experience.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">2. Which cookies we use</h2>

          <h3 className="font-semibold mt-4 mb-1">A) Strictly necessary cookies (no consent required)</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><code>supabase-auth-token</code> – authentication (session, 1 year)</li>
            <li><code>supabase-auth-refresh</code> – token refresh (1 year)</li>
            <li><code>csrf-token</code> – protection against CSRF (session)</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">B) Functional cookies (consent required)</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><code>language-preference</code> – language (12 months)</li>
            <li><code>theme-preference</code> – light/dark mode (12 months)</li>
            <li><code>cookie-consent-preferences</code> – your cookie choices (24 months)</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">C) Analytics cookies (consent required)</h3>
          <p className="text-muted-foreground">No analytics cookies are currently active.</p>

          <h3 className="font-semibold mt-4 mb-1">D) Marketing cookies (consent required)</h3>
          <p className="text-muted-foreground">No marketing cookies are currently active.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">3. Third-party cookies</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>
              Stripe Payments: stripe.com sets its own cookies during checkout (
              <a href="https://stripe.com/cookies-policy" target="_blank" rel="noreferrer" className="text-primary underline">
                stripe.com/cookies-policy
              </a>
              )
            </li>
            <li>No Google Analytics, no Facebook Pixel, no advertising trackers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">4. Your consent</h2>
          <p className="text-muted-foreground">
            A cookie banner appears on your first visit. You can accept all, accept only necessary,
            choose individually, or change your choice at any time under{" "}
            <Link to="/cookie-settings" className="text-primary underline">
              /cookie-settings
            </Link>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">5. Blocking cookies</h2>
          <p className="text-muted-foreground">
            You can block cookies in your browser settings. Consequence: some features (sign-in, purchases) will not work.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">6. Retention</h2>
          <p className="text-muted-foreground">Maximum 24 months. Session cookies end when the browser is closed.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">7. Changes</h2>
          <p className="text-muted-foreground">
            This policy may be updated. On material changes, the cookie banner will appear again.
          </p>
        </section>

        <p className="text-sm text-muted-foreground pt-8 border-t border-border">
          Questions? Email{" "}
          <a href="mailto:support@dkaimarketplace.com" className="text-primary underline">
            support@dkaimarketplace.com
          </a>{" "}
          – Read also:{" "}
          <Link to="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
        </p>
      </article>
    </main>
  );
}
