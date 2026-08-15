import { Helmet } from 'react-helmet-async';
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
  /** Pages that own their <head> imperatively (dynamic product/blog pages). */
  skipTitle?: boolean;
  noindex?: boolean;
}

/**
 * Per-route titles and descriptions. Keys are React Router path patterns.
 * Routes not listed keep the site default; routes flagged `skipTitle` manage
 * their own title/description in the page component.
 */
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
    description:
      'Rules and quality standards for selling AI agents, automations, and prompts on DK AI Marketplace.',
  },
  // Pages that build their own title/description dynamically.
  '/product/:id': { title: '', description: '', skipTitle: true },
  '/blog/top-ai-agent-marketplaces': { title: '', description: '', skipTitle: true },
  '/refund-policy': { title: '', description: '', skipTitle: true },
  '/legal/refund': { title: '', description: '', skipTitle: true },
  '/legal/refund-policy': { title: '', description: '', skipTitle: true },
};

function findMeta(pathname: string): RouteMeta | undefined {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  for (const pattern of Object.keys(ROUTE_META)) {
    if (pattern.includes(':') && matchPath(pattern, pathname)) return ROUTE_META[pattern];
  }
  return undefined;
}

/**
 * Emits a self-referencing canonical/og:url for every route, plus a unique
 * title and description for known routes. Rendered once inside the router.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const url = `${SITE_URL}${pathname}`;
  const meta = findMeta(pathname);
  const showTitle = !!meta && !meta.skipTitle;

  return (
    <Helmet>
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
      {showTitle && <title>{meta!.title}</title>}
      {showTitle && <meta name="description" content={meta!.description} />}
      {showTitle && <meta property="og:title" content={meta!.title} />}
      {showTitle && <meta property="og:description" content={meta!.description} />}
      {showTitle && <meta name="twitter:title" content={meta!.title} />}
      {showTitle && <meta name="twitter:description" content={meta!.description} />}
      {meta?.noindex && <meta name="robots" content="noindex, follow" />}
    </Helmet>
  );
}

export default RouteSeo;
