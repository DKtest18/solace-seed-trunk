import { Link } from 'react-router-dom';

const platformLinks = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/meetings', label: 'Meetings' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/community', label: 'Community' },
];

const legalLinks = [
  { to: '/legal/imprint', label: 'Impressum' },
  { to: '/legal/privacy', label: 'Datenschutz' },
  { to: '/legal/terms', label: 'AGB' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/legal/refund', label: 'Widerruf' },
];

export function Footer() {
  return (
    <footer className="bg-background-soft border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: Logo + tagline */}
          <div className="space-y-4">
            <Link to="/" className="inline-block bg-gray-900 rounded-lg p-1 px-2 hover:opacity-90 transition-opacity">
              <img src="/logo.png" alt="DK AI Marketplace" className="h-9 w-auto" />
            </Link>
            <p className="accent-serif text-muted">
              Made by AI, made for AI. — DK
            </p>
          </div>

          {/* Column 2: Platform */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-sm">Platform</h3>
            <ul className="space-y-2">
              {platformLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted hover:text-gray-900 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-sm">Contact</h3>
            <a
              href="mailto:support@dkaimarketplace.com"
              className="text-sm text-muted hover:text-gray-900 transition-colors block"
            >
              support@dkaimarketplace.com
            </a>
          </div>
        </div>

        {/* Legal links */}
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
          {legalLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-xs text-muted hover:text-gray-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Bottom row */}
        <div className="border-t border-border pt-6 mt-12 flex items-center justify-between">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} DK AI Marketplace. All rights reserved.
          </p>
          <div />
        </div>
      </div>
    </footer>
  );
}
