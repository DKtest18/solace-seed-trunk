import { ReactNode, useState } from 'react';
import { LegalFooter } from '@/components/LegalFooter';
import { SearchSidebar } from '@/components/SearchSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Search, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  showMessagesSidebar?: boolean; // kept for backwards-compat; controls right search sidebar
}

export function AppLayout({ children, showMessagesSidebar = true }: AppLayoutProps) {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [rightOpen, setRightOpen] = useState(false);

  const hideOnPaths = ['/', '/login', '/signup'];
  const hideSidebars = hideOnPaths.includes(location.pathname);

  if (!user || hideSidebars) {
    return <div className="min-h-screen flex flex-col"><div className="flex-1">{children}</div><LegalFooter /></div>;
  }

  const rightContent = showMessagesSidebar ? <SearchSidebar /> : null;

  if (isMobile) {
    return (
      <SidebarProvider>
        <div className="flex flex-col min-h-screen w-full">
          {rightContent && (
            <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full shadow-lg h-11 w-11"
                onClick={() => setRightOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          )}

          {rightContent && (
            <Sheet open={rightOpen} onOpenChange={setRightOpen}>
              <SheetContent side="right" className="p-0 w-[85vw] max-w-sm">
                <SheetTitle className="sr-only">Search</SheetTitle>
                <div className="h-full overflow-auto">{rightContent}</div>
              </SheetContent>
            </Sheet>
          )}

          <main className="flex-1 overflow-auto min-w-0">{children}</main>
          <LegalFooter />
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 overflow-auto">{children}</main>
          <LegalFooter />
        </div>

        {rightContent && (
          <div className="relative flex">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -left-10 top-2 z-30 h-8 w-8 rounded-full border bg-card shadow-sm"
              onClick={() => setRightOpen(!rightOpen)}
              title={rightOpen ? 'Close right panel' : 'Open right panel'}
            >
              {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
            {rightOpen && (
              <div className="w-72 border-l bg-card/50 backdrop-blur-sm shrink-0 h-[calc(100vh-60px)] sticky top-[60px] overflow-hidden">
                {rightContent}
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
