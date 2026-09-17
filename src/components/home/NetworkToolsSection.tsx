import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import nordpixelLogo from '@/assets/network-tools/nordpixel-logo.png';
import makeLogo from '@/assets/network-tools/make-logo.png';
import elevenLabsLogo from '@/assets/network-tools/elevenlabs-logo.svg';

type NetworkTool = {
  id: 'nordpixel' | 'make' | 'elevenlabs';
  name: string;
  href: string;
  rel: 'nofollow noopener' | 'sponsored noopener';
  logo?: string;
};

const NETWORK_TOOLS: readonly NetworkTool[] = [
  {
    id: 'nordpixel',
    name: 'Nordpixel',
    href: 'https://nordpixel.ch/',
    rel: 'nofollow noopener',
    logo: nordpixelLogo,
  },
  {
    id: 'make',
    name: 'Make',
    href: 'https://www.make.com/en/register?pc=dkaimarketplace',
    rel: 'sponsored noopener',
    logo: makeLogo,
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    href: 'https://try.elevenlabs.io/xvp7u1giipi7',
    rel: 'sponsored noopener',
    logo: elevenLabsLogo,
  },
] as const;

type ToolCardProps = {
  tool: NetworkTool;
  keyboardAccessible: boolean;
};

function ToolCard({ tool, keyboardAccessible }: ToolCardProps) {
  const { t } = useTranslation();
  const relationship = t(`landing.networkTools.items.${tool.id}.relationship`);
  const description = t(`landing.networkTools.items.${tool.id}.description`);

  return (
    <a
      href={tool.href}
      target="_blank"
      rel={tool.rel}
      tabIndex={keyboardAccessible ? undefined : -1}
      aria-label={keyboardAccessible ? t('landing.networkTools.linkLabel', { company: tool.name, relationship }) : undefined}
      className="network-tool-card"
    >
      <span className="network-tool-logo" aria-hidden="true">
        {tool.logo ? (
          <img src={tool.logo} alt="" width="240" height="86" loading="lazy" />
        ) : (
          <span className="network-tool-wordmark">{tool.name}</span>
        )}
      </span>
      <span className="network-tool-copy">
        <span className="network-tool-name">
          {tool.name}
          <ExternalLink aria-hidden="true" />
        </span>
        <span className={`network-tool-label network-tool-label-${tool.id === 'nordpixel' ? 'network' : 'affiliate'}`}>
          {relationship}
        </span>
        <span className="network-tool-description">{description}</span>
      </span>
    </a>
  );
}

function ToolList({ keyboardAccessible, className }: { keyboardAccessible: boolean; className: string }) {
  return (
    <ul className={className}>
      {NETWORK_TOOLS.map((tool) => (
        <li key={tool.id}>
          <ToolCard tool={tool} keyboardAccessible={keyboardAccessible} />
        </li>
      ))}
    </ul>
  );
}

export function NetworkToolsSection() {
  const { t } = useTranslation();

  return (
    <section className="network-tools-section relative py-20" aria-labelledby="network-tools-title">
      <div className="max-w-6xl mx-auto px-6">
        <div className="network-tools-heading">
          <div>
            <h2 id="network-tools-title" className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
              {t('landing.networkTools.title')}
            </h2>
            <p className="text-[var(--text-muted)]">{t('landing.networkTools.subtitle')}</p>
          </div>
        </div>

        <div className="network-tools-experience">
          <div className="network-tools-static">
            <ToolList keyboardAccessible className="network-tools-static-list" />
          </div>

          <div className="network-tools-marquee" aria-hidden="true">
            <div className="network-tools-track">
              {[0, 1].map((half) => (
                <div className="network-tools-group" key={half}>
                  {[0, 1].map((repeat) => (
                    <ToolList
                      key={`${half}-${repeat}`}
                      keyboardAccessible={false}
                      className="network-tools-animated-list"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="network-tools-disclosure">{t('landing.networkTools.disclosure')}</p>
      </div>
    </section>
  );
}