import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { HourglassLoader } from '@/components/HourglassLoader';

interface Props {
  children: ReactNode;
}

/**
 * Auth-only guard. The user waitlist has been removed — anyone who is
 * signed in (and email-verified by Supabase) can access protected routes.
 * Component name kept for compatibility with existing route wrappers.
 */
export function WaitlistGuard({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HourglassLoader size="lg" label />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
