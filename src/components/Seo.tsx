import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://dkaimarketplace.com';
const SITE_NAME = 'DK AI Marketplace';

interface SeoProps {
  /** Page-specific title. Rendered as "<title> | DK AI Marketplace" unless `standalone` is set. */
  title: string;
  description: string;
  /** Use the title verbatim without the site-name suffix. */
  standalone?: boolean;
  /** Override the canonical/og:url path (defaults to the current route). */
  path?: string;
  image?: string;
  noindex?: boolean;
  children?: React.ReactNode;
}

export function Seo({ title, description, standalone, path, image, noindex, children }: SeoProps) {
  const location = useLocation();
  const pathname = path ?? location.pathname;
  const url = `${SITE_URL}${pathname}`;
  const fullTitle = standalone ? title : `${title} | ${SITE_NAME}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta property="og:image" content={image} />}
      {image && <meta name="twitter:image" content={image} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {children}
    </Helmet>
  );
}

export default Seo;
