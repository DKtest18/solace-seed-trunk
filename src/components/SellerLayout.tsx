import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';

interface SellerLayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * Consistent layout wrapper for every seller-portal page so the left
 * sidebar stays visible and routing remains in-app on every screen.
 */
export function SellerLayout({ children, title }: SellerLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <SellerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            {title && <h1 className="text-xl font-bold">{title}</h1>}
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
