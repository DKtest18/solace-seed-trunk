import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { NotificationsList } from '@/components/NotificationsList';

export default function Notifications() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg mb-4">Please log in to view notifications</p>
          <Button asChild>
            <Link to="/login">Log In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-8">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">Notifications</h1>
          <NotificationsList />
        </div>
      </div>
    </AppLayout>
  );
}
