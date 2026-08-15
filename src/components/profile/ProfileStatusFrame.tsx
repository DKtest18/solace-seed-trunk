import { ReactNode } from 'react';

interface Props {
  openToWork?: boolean | null;
  openToRoles?: string | null;
  isHiring?: boolean | null;
  hiringRoles?: string | null;
  children: ReactNode;
}

/**
 * LinkedIn-style frame around the avatar: a colored ring plus a banner
 * label ("#OpenToWork" / "#Hiring") sitting on the bottom edge.
 */
export function ProfileStatusFrame({ openToWork, openToRoles, isHiring, hiringRoles, children }: Props) {
  const mode = openToWork ? 'work' : isHiring ? 'hiring' : null;
  if (!mode) return <>{children}</>;

  const ring = mode === 'work' ? 'ring-primary' : 'ring-emerald-600';
  const chip = mode === 'work' ? 'bg-primary text-primary-foreground' : 'bg-emerald-600 text-white';
  const label = mode === 'work' ? '#OpenToWork' : '#Hiring';
  const title = mode === 'work' ? openToRoles || 'Open to work' : hiringRoles || 'Hiring';

  return (
    <div className={`relative rounded-full ring-4 ${ring} p-0.5`} title={title}>
      {children}
      <span
        className={`absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/3 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-md ${chip}`}
      >
        {label}
      </span>
    </div>
  );
}
