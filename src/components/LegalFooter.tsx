import { Link } from 'react-router-dom';

const links = [
  { to: '/legal/imprint', label: 'Impressum' },
  { to: '/legal/privacy', label: 'Datenschutz' },
  { to: '/legal/terms', label: 'AGB' },
  { to: '/legal/licenses', label: 'License Terms' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/legal/refund', label: 'Widerruf' },
];

export function LegalFooter() {
  return (
    <footer className="border-t bg-card/50 backdrop-blur-sm py-4 px-6">
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <span className="text-xs">© {new Date().getFullYear()} DK AI Marketplace</span>
      </div>
    </footer>
  );
}
