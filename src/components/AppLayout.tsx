import { ReactNode, useState } from 'react';
import { LegalFooter } from '@/components/LegalFooter';
import { MessagesSidebar } from '@/components/MessagesSidebar';
import { SearchSidebar } from '@/components/SearchSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { MessageSquare, Search, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  showMessagesSidebar?: boolean;
}

export function AppLayout({ children, showMessagesSidebar = true }: AppLayoutProps) {
  const { user } = useAuth();
  const location = useLocation();
  const { settings } = useUserSettings();
  const isMobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(!isMobile);
  const [rightOpen, setRightOpen] = useState(false);

  const hideOnPaths = ['/', '/login', '/signup'];
  const hideSidebars = hideOnPaths.includes(location.pathname);

  if (!user || hideSidebars) {
    return <div className="min-h-screen">{children}</div>;
  }

  const layout = settings.sidebar_layout || 'default';

  const getLeftContent = () => {
    if (!showMessagesSidebar) return null;
    switch (layout) {
      case 'search-seller':
      case 'messages-search':
        return <SearchSidebar />;
      default:
        return <MessagesSidebar />;
    }
  };

  const leftContent = getLeftContent();
  const rightContent = showMessagesSidebar ? (
    layout === 'messages-search' ? <MessagesSidebar /> : <SearchSidebar />
  ) : null;

  // On mobile, use Sheet overlays
  if (isMobile) {
    return (
      <SidebarProvider>
        <div className="flex flex-col min-h-screen w-full">
          {/* Floating toggle buttons */}
          <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2">
            {leftContent && (
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full shadow-lg h-11 w-11"
                onClick={() => setLeftOpen(true)}
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
            )}
            {rightContent && (
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full shadow-lg h-11 w-11"
                onClick={() => setRightOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Left Sheet */}
          {leftContent && (
            <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
              <SheetContent side="left" className="p-0 w-[85vw] max-w-sm">
                <SheetTitle className="sr-only">Sidebar</SheetTitle>
                <div className="h-full overflow-auto">{leftContent}</div>
              </SheetContent>
            </Sheet>
          )}

          {/* Right Sheet */}
          {rightContent && (
            <Sheet open={rightOpen} onOpenChange={setRightOpen}>
              <SheetContent side="right" className="p-0 w-[85vw] max-w-sm">
                <SheetTitle className="sr-only">Search</SheetTitle>
                <div className="h-full overflow-auto">{rightContent}</div>
              </SheetContent>
            </Sheet>
          )}

          <main className="flex-1 overflow-auto min-w-0">
            {children}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  // Desktop: collapsible panels with toggle buttons
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Left sidebar */}
        {leftContent && (
          <div className="relative flex">
            {leftOpen && (
              <div className="w-80 border-r bg-card/50 backdrop-blur-sm shrink-0 h-[calc(100vh-60px)] sticky top-[60px] overflow-hidden">
                {leftContent}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-10 top-2 z-30 h-8 w-8 rounded-full border bg-card shadow-sm"
              onClick={() => setLeftOpen(!leftOpen)}
              title={leftOpen ? 'Close left panel' : 'Open left panel'}
            >
              {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>

        {/* Right sidebar */}
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
