import {
  Bot,
  Zap,
  Workflow,
  MessageSquareText,
  LayoutTemplate,
  Database,
  Store,
  Trophy,
  Users,
  BarChart3,
  Info,
  BookOpen,
  Scale,
  type LucideIcon,
} from 'lucide-react';

export type NavEntry = {
  to: string;
  icon: LucideIcon;
  /** i18n key for the label */
  labelKey: string;
  /** i18n key for the one-line description */
  descKey: string;
};

/**
 * Marketplace dropdown — every link maps to a filter the Marketplace page
 * actually supports (product_type via ?type=, tags via ?tag=).
 */
export const MARKETPLACE_ENTRIES: NavEntry[] = [
  { to: '/marketplace', icon: Store, labelKey: 'nav.menu.browseAll', descKey: 'nav.menu.browseAllDesc' },
  { to: '/marketplace?type=agent', icon: Bot, labelKey: 'landing.categories.aiAgents', descKey: 'nav.menu.aiAgentsDesc' },
  { to: '/marketplace?type=software', icon: Zap, labelKey: 'landing.categories.automations', descKey: 'nav.menu.automationsDesc' },
  { to: '/marketplace?tag=workflow', icon: Workflow, labelKey: 'landing.categories.workflows', descKey: 'nav.menu.workflowsDesc' },
  { to: '/marketplace?tag=prompts', icon: MessageSquareText, labelKey: 'landing.categories.prompts', descKey: 'nav.menu.promptsDesc' },
  { to: '/marketplace?tag=template', icon: LayoutTemplate, labelKey: 'landing.categories.templates', descKey: 'nav.menu.templatesDesc' },
  { to: '/marketplace?tag=dataset', icon: Database, labelKey: 'landing.categories.datasets', descKey: 'nav.menu.datasetsDesc' },
];

/** Second dropdown — existing public informational pages only. */
export const DISCOVER_ENTRIES: NavEntry[] = [
  { to: '/top-products', icon: Trophy, labelKey: 'nav.topProducts', descKey: 'nav.menu.topProductsDesc' },
  { to: '/top-sellers', icon: Users, labelKey: 'nav.topSellers', descKey: 'nav.menu.topSellersDesc' },
  { to: '/statistics', icon: BarChart3, labelKey: 'nav.statistics', descKey: 'nav.menu.statisticsDesc' },
  { to: '/about', icon: Info, labelKey: 'nav.menu.about', descKey: 'nav.menu.aboutDesc' },
  { to: '/seller-guidelines', icon: Scale, labelKey: 'nav.menu.sellerGuidelines', descKey: 'nav.menu.sellerGuidelinesDesc' },
  // Blog entry temporarily disabled
  { to: '/legal', icon: Scale, labelKey: 'nav.menu.legal', descKey: 'nav.menu.legalDesc' },
];
