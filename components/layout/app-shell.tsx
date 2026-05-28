"use client";

import { Sidebar } from "@/components/layout/sidebar";
import {
  DrawerProvider,
  useDrawerPortal,
} from "@/components/ui/drawer-context";
import { SidebarHeaderProvider } from "@/components/layout/sidebar-header-context";
import { MobileNavProvider, useMobileNav } from "@/components/layout/mobile-nav-context";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/brand-mark";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { portalRef, isOpen } = useDrawerPortal();
  const { setIsOpen: setNavOpen } = useMobileNav();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col md:ml-45 min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon" aria-label="메뉴 열기" onClick={() => setNavOpen(true)}>
            <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
          </Button>
          <BrandMark compact className="text-primary" />
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
      <aside
        ref={portalRef}
        className={cn(
          "shrink-0 flex flex-col bg-background overflow-hidden",
          "fixed inset-x-0 bottom-0 h-[90vh] rounded-t-2xl shadow-xl",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "z-[60]" : "z-50",
          isOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
          "md:sticky md:inset-auto md:top-0 md:h-screen md:max-h-none md:rounded-none md:border-l md:shadow-none",
          "md:transition-[width] md:duration-300 md:ease-in-out",
          "md:translate-y-0 md:pointer-events-auto",
          isOpen ? "md:z-[60] md:w-[min(640px,76vw)] xl:w-[40%]" : "md:z-auto md:w-0 md:border-l-0",
        )}
      />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DrawerProvider>
      <SidebarHeaderProvider>
        <MobileNavProvider>
          <AppShellInner>{children}</AppShellInner>
        </MobileNavProvider>
      </SidebarHeaderProvider>
    </DrawerProvider>
  );
}
