import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsActive } from '@/hooks/useIsActive';

interface Props {
  children: ReactNode;
}

/**
 * Blocks access to protected app surfaces (marketplace, products, meetings,
 * settings, etc.) until the user has been approved off the waitlist.
 * Admins always pass. Unauthenticated users are sent to /login.
 */
export function WaitlistGuard({ children }: Props) {
  const { user, loading } = useAuth();
  const { isActive, isLoading } = useIsActive();
  const location = useLocation();

  if (loading || (user && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isActive) {
    return <Navigate to="/waitlist" replace />;
  }

  return <>{children}</>;
}
