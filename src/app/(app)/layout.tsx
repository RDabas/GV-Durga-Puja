import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { PujaDataProvider } from "@/lib/store";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <PujaDataProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-ground sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[32px] sm:border sm:border-border sm:shadow-xl">
        <AppHeader />
        <main className="flex-1 space-y-4 overflow-y-auto px-5 pb-6">{children}</main>
        <BottomNav />
      </div>
    </PujaDataProvider>
  );
}
