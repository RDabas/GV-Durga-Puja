"use client";

import { useState } from "react";
import { ChevronRightIcon, TrishulIcon } from "@/components/icons";
import { YearSheet } from "@/components/YearSheet";
import { usePujaData } from "@/lib/store";

function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const startLabel = start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `Shashthi ${startLabel} – Dashami ${endLabel}`;
}

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { activeYear } = usePujaData();
  const [switching, setSwitching] = useState(false);
  const isHistory = activeYear.status === "archived";

  return (
    <header className="shrink-0 px-5 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand to-brand-strong shadow-sm">
            <TrishulIcon className="h-[17px] w-[17px]" />
          </span>
          <span className="font-display text-[1.22rem] font-extrabold text-ink">
            GV Durga Puja
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSwitching(true)}
          aria-label={`Puja year ${activeYear.year} — switch year`}
          className={`flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums ${
            isHistory ? "bg-ground-alt text-ink-soft" : "bg-brand-tint text-brand"
          }`}
        >
          {activeYear.year}
          <ChevronRightIcon className="h-[12px] w-[12px] rotate-90" />
        </button>
      </div>
      <p className="mt-1 text-[0.78rem] text-ink-faint">
        {isHistory
          ? `Viewing ${activeYear.year} history`
          : subtitle ?? formatDateRange(activeYear.shashthiDate, activeYear.dashamiDate)}
      </p>

      <YearSheet open={switching} onClose={() => setSwitching(false)} />
    </header>
  );
}
