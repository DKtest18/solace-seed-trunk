import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { MARKETPLACE_ENTRIES, DISCOVER_ENTRIES, type NavEntry } from './mainNavItems';

function EntryLink({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const Icon = entry.icon;
  const isActive = `${pathname}${search}` === entry.to;

  return (
    <NavigationMenuLink asChild>
      <Link
        to={entry.to}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-start gap-3 rounded-md p-3 outline-none transition-colors',
          'hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          isActive && 'bg-accent',
        )}
      >
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
        <span className="min-w-0">
          <span className={cn('block text-sm font-medium', isActive && 'text-primary')}>{t(entry.labelKey)}</span>
          <span className="block text-xs leading-snug text-muted-foreground">{t(entry.descKey)}</span>
        </span>
      </Link>
    </NavigationMenuLink>
  );
}

export function MainNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const [value, setValue] = useState('');

  // Close any open dropdown when the route changes.
  useEffect(() => setValue(''), [location.pathname, location.search]);

  const isHome = location.pathname === '/';
  const inMarketplace = location.pathname.startsWith('/marketplace') || location.pathname.startsWith('/product/');
  const inDiscover = DISCOVER_ENTRIES.some((e) => location.pathname.startsWith(e.to));

  return (
    <NavigationMenu value={value} onValueChange={setValue} className="hidden md:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link
              to="/"
              aria-current={isHome ? 'page' : undefined}
              className={cn(
                navigationMenuTriggerStyle(),
                'bg-transparent text-sm font-medium',
                isHome ? 'text-primary' : 'text-gray-700 hover:text-primary',
              )}
            >
              {t('nav.home')}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        <NavigationMenuItem value="marketplace">
          <NavigationMenuTrigger
            className={cn('bg-transparent text-sm font-medium', inMarketplace ? 'text-primary' : 'text-gray-700')}
          >
            {t('nav.marketplace')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[560px] gap-1 p-3 md:grid-cols-2">
              {MARKETPLACE_ENTRIES.map((entry) => (
                <li key={entry.to}>
                  <EntryLink entry={entry} />
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem value="discover">
          <NavigationMenuTrigger
            className={cn('bg-transparent text-sm font-medium', inDiscover ? 'text-primary' : 'text-gray-700')}
          >
            {t('nav.menu.discover')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[560px] gap-1 p-3 md:grid-cols-2">
              {DISCOVER_ENTRIES.map((entry) => (
                <li key={entry.to}>
                  <EntryLink entry={entry} />
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
