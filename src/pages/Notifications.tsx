import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { NotificationsList } from '@/components/NotificationsList';
import { useHasRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/AppLayout';
import { SellerLayout } from '@/components/SellerLayout';

export default function Notifications() {
  const { user } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');

  if (!user) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-lg mb-4">Please log in to view notifications</p>
            <Button asChild>
              <Link to="/login">Log In</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const content = (
    <div className="container mx-auto max-w-3xl py-8 px-6">
      <h1 className="text-3xl font-bold mb-8">Notifications</h1>
      <NotificationsList />
    </div>
  );

  if (isSeller || isAdmin) {
    return <SellerLayout title="Notifications">{content}</SellerLayout>;
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">{content}</div>
    </AppLayout>
  );
}
