import { useEffect } from 'react';
import { useLocation, matchPath } from 'react-router-dom';

const SITE_URL = 'https://dkaimarketplace.com';
const SITE_NAME = 'DK AI Marketplace';

/** Site-wide defaults (must mirror index.html). */
const DEFAULT_TITLE = 'DK AI Marketplace — Buy & Sell AI Agents';
const DEFAULT_DESCRIPTION =
  'The marketplace for AI builders and buyers. Buy and sell AI agents, automations, prompts, and digital tools — payments powered by Stripe.';

interface RouteMeta {
  title: string;
  description: string;
  /** Pages that build their own title/description (dynamic product/blog pages). */
  own?: boolean;
  noindex?: boolean;
}

/** Per-route titles and descriptions. Keys are React Router path patterns. */
const ROUTE_META: Record<string, RouteMeta> = {
  '/': { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  '/marketplace': {
    title: `Marketplace — Browse AI Agents & Automations | ${SITE_NAME}`,
    description:
      'Browse AI agents, automations, prompts, and digital tools from verified builders. Filter by category, license type, and price.',
  },
  '/top-products': {
    title: `Top AI Products — Highest Rated & Trending | ${SITE_NAME}`,
    description:
      'The highest-rated and best-selling AI agents, automations, and prompts on DK AI Marketplace, ranked by real buyer reviews.',
  },
  '/top-sellers': {
    title: `Top AI Sellers — Leading Builders | ${SITE_NAME}`,
    description:
      'Meet the leading AI builders on DK AI Marketplace, ranked by sales, ratings, and achievements. Browse their products and profiles.',
  },
  '/statistics': {
    title: `Platform Statistics | ${SITE_NAME}`,
    description:
      'Live platform metrics for DK AI Marketplace: products listed, active sellers, categories, and marketplace activity.',
  },
  '/about': {
    title: `About Us — How the Marketplace Works | ${SITE_NAME}`,
    description:
      'Learn how DK AI Marketplace connects AI builders with buyers, how payouts work via Stripe Connect, and what sellers keep.',
  },
  '/waitlist': {
    title: `Join the Waitlist | ${SITE_NAME}`,
    description:
      'Request early access to DK AI Marketplace and be first to buy or sell AI agents, automations, and prompts.',
  },
  '/login': {
    title: `Log In | ${SITE_NAME}`,
    description: 'Log in to your DK AI Marketplace account to manage purchases, listings, and payouts.',
    noindex: true,
  },
  '/signup': {
    title: `Create an Account | ${SITE_NAME}`,
    description: 'Create a free buyer or seller account on DK AI Marketplace and start trading AI products.',
    noindex: true,
  },
  '/legal': {
    title: `Legal Overview — Terms, Privacy & Policies | ${SITE_NAME}`,
    description:
      'All legal documents for DK AI Marketplace in one place: terms of service, privacy policy, refunds, licenses, and imprint.',
  },
  '/terms': {
    title: `Terms of Service | ${SITE_NAME}`,
    description:
      'The terms of service governing use of DK AI Marketplace for buyers and sellers, including payments and prohibited conduct.',
  },
  '/agb': {
    title: `Terms of Service (AGB) | ${SITE_NAME}`,
    description:
      'The terms of service governing use of DK AI Marketplace for buyers and sellers, including payments and prohibited conduct.',
  },
  '/privacy': {
    title: `Privacy Policy | ${SITE_NAME}`,
    description:
      'How DK AI Marketplace collects, uses, and protects personal data, including GDPR rights, data export, and deletion.',
  },
  '/datenschutz': {
    title: `Privacy Policy (Datenschutz) | ${SITE_NAME}`,
    description:
      'How DK AI Marketplace collects, uses, and protects personal data, including GDPR rights, data export, and deletion.',
  },
  '/cookies': {
    title: `Cookie Policy | ${SITE_NAME}`,
    description: 'Which cookies DK AI Marketplace uses, why they are set, and how to manage your cookie preferences.',
  },
  '/cookie-settings': {
    title: `Cookie Settings | ${SITE_NAME}`,
    description: 'Manage your cookie preferences for DK AI Marketplace, including analytics and functional cookies.',
  },
  '/impressum': {
    title: `Imprint (Impressum) | ${SITE_NAME}`,
    description: 'Legal imprint and operator information for DK AI Marketplace.',
  },
  '/legal/imprint': {
    title: `Imprint (Impressum) | ${SITE_NAME}`,
    description: 'Legal imprint and operator information for DK AI Marketplace.',
  },
  '/legal/licenses': {
    title: `License Terms | ${SITE_NAME}`,
    description:
      'License types available on DK AI Marketplace: personal, commercial, extended, and exclusive ownership buyouts.',
  },
  '/seller-guidelines': {
    title: `Seller Guidelines | ${SITE_NAME}`,
    description: 'Rules and quality standards for selling AI agents, automations, and prompts on DK AI Marketplace.',
  },
  // Pages that set their own title/description imperatively.
  '/product/:id': { title: '', description: '', own: true },
  '/blog/top-ai-agent-marketplaces': { title: '', description: '', own: true },
  '/refund-policy': { title: '', description: '', own: true },
  '/legal/refund': { title: '', description: '', own: true },
  '/legal/refund-policy': { title: '', description: '', own: true },
};

function findMeta(pathname: string): RouteMeta | undefined {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  for (const pattern of Object.keys(ROUTE_META)) {
    if (pattern.includes(':') && matchPath(pattern, pathname)) return ROUTE_META[pattern];
  }
  return undefined;
}

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Keeps the document head in sync with the active route: a self-referencing
 * canonical and og:url for every page, plus a unique title/description and
 * matching social tags for known routes.
 */
export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const url = `${SITE_URL}${pathname}`;
    upsertCanonical(url);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);

    const meta = findMeta(pathname);

    // Robots: only set noindex where declared, otherwise clear a stale one.
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (meta?.noindex) {
      upsertMeta('meta[name="robots"]', 'name', 'robots', 'noindex, follow');
    } else if (robots) {
      robots.remove();
    }

    if (!meta || meta.own) return;

    document.title = meta.title;
    upsertMeta('meta[name="description"]', 'name', 'description', meta.description);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);
  }, [pathname]);

  return null;
}

export default RouteSeo;
