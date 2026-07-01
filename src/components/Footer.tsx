import { Link, useLocation } from 'react-router-dom';
import { Linkedin } from 'lucide-react';

const LINKEDIN_URL = 'https://www.linkedin.com/company/dk-ai-marketplace';

const platformLinks = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/seller-guidelines', label: 'Seller Guidelines' },
];

const companyLinks = [
  { to: '/about', label: 'About' },
  { href: 'mailto:support@dkaimarketplace.com', label: 'Contact' },
  { href: LINKEDIN_URL, label: 'Follow us on LinkedIn', external: true },
];

const legalLinks = [
  { to: '/impressum', label: 'Legal Notice (Impressum)' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/cookies', label: 'Cookie Policy' },
  { to: '/cookie-settings', label: 'Cookie Settings' },
];

export function Footer() {
  const location = useLocation();

  const isAuthFlow =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/check-email' ||
    location.pathname.startsWith('/auth/');

  if (isAuthFlow) return null;

  return (
    <footer className="bg-foreground/5 border-t border-border">
      <div className="max-w-7xl mx-auto py-12 md:py-16 px-6">
        {/* 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block bg-gray-900 rounded-lg p-1 px-2 hover:opacity-90 transition-opacity">
              <img src="/logo.png" alt="DK AI Marketplace" className="h-9 w-auto" />
            </Link>
            <p className="font-serif italic text-muted-foreground">
              &ldquo;Made by AI, made for AI. - DK&rdquo;
            </p>
            <p className="text-sm text-muted-foreground">
              The marketplace for AI builders and buyers worldwide.
            </p>
          </div>

          {/* Column 2: Platform */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-foreground">Platform</h4>
            <ul className="space-y-2">
              {platformLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-foreground">Company</h4>
            <ul className="space-y-2">
              {companyLinks.map((link) =>
                link.external ? (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ) : link.href ? (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ) : (
                  <li key={link.to}>
                    <Link
                      to={link.to!}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-foreground">Legal</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border my-8" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            2026 DK AI Marketplace.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Built in Switzerland — Compliant with Swiss FADP and EU GDPR.
          </p>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="DK AI Marketplace on LinkedIn"
          >
            <Linkedin className="w-5 h-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
