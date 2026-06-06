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
  const { portalRef, isOpen, drawerSize } = useDrawerPortal();
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
          "fixed inset-x-0 bottom-0 z-[60] h-[90vh] overflow-hidden rounded-t-2xl bg-background shadow-xl",
          "[transform:var(--drawer-transform)] transition-transform duration-300 ease-in-out",
          isOpen
            ? "[--drawer-transform:translateX(0)]"
            : "[--drawer-transform:translateY(100%)] pointer-events-none md:[--drawer-transform:translateX(100%)]",
          "md:inset-y-0 md:left-auto md:right-0 md:h-screen md:max-h-none md:rounded-none md:border-l",
          drawerSize === "wide"
            ? "md:w-[min(1040px,calc(100vw-13rem))] xl:w-[min(1120px,calc(100vw-13rem))]"
            : "md:w-[min(640px,76vw)] xl:w-[40%]",
          "md:transition-transform md:duration-300 md:ease-in-out",
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
