import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { NotificationsList } from '@/components/NotificationsList';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { useHasRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/AppLayout';

export default function Notifications() {
  const { user } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');

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

  const content = (
    <div className="container mx-auto max-w-3xl py-8 px-6">
      <h1 className="text-3xl font-bold mb-8">Notifications</h1>
      <NotificationsList />
    </div>
  );

  if (isSeller || isAdmin) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <SellerSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-6 sticky top-0 z-10">
              <SidebarTrigger className="mr-4" />
              <h1 className="text-xl font-bold">Notifications</h1>
            </header>
            <main className="flex-1 overflow-auto">
              {content}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-8">
        {content}
      </div>
    </AppLayout>
  );
}
