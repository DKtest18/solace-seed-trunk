import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
