import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { MARKETPLACE_ENTRIES, DISCOVER_ENTRIES, type NavEntry } from './mainNavItems';

function Row({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const Icon = entry.icon;
  const isActive = `${pathname}${search}` === entry.to;
  return (
    <Link
      to={entry.to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isActive && 'bg-accent text-primary',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
      {t(entry.labelKey)}
    </Link>
  );
}

/** Accordion version of the main navigation for the mobile sheet. */
export function MobileMainNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <div className="px-2">
      <Link
        to="/"
        onClick={onNavigate}
        aria-current={pathname === '/' ? 'page' : undefined}
        className={cn(
          'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-accent transition-colors',
          pathname === '/' && 'text-primary bg-accent',
        )}
      >
        {t('nav.home')}
      </Link>

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="marketplace" className="border-none">
          <AccordionTrigger className="px-3 py-2.5 text-sm font-medium hover:no-underline">
            {t('nav.marketplace')}
          </AccordionTrigger>
          <AccordionContent className="pb-1">
            <div className="space-y-1 pl-2">
              {MARKETPLACE_ENTRIES.map((e) => (
                <Row key={e.to} entry={e} onNavigate={onNavigate} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="discover" className="border-none">
          <AccordionTrigger className="px-3 py-2.5 text-sm font-medium hover:no-underline">
            {t('nav.menu.discover')}
          </AccordionTrigger>
          <AccordionContent className="pb-1">
            <div className="space-y-1 pl-2">
              {DISCOVER_ENTRIES.map((e) => (
                <Row key={e.to} entry={e} onNavigate={onNavigate} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
