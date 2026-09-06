"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden sm:items-center">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Plain vh, not dvh: some mobile browsers/WebViews silently drop an
        // unsupported dvh value with no max-height at all, letting a long
        // form (landscape especially, where viewport height is small to
        // begin with) grow past the screen with no way to reach Save.
        // overscroll-contain stops the page behind from scrolling through.
        className="relative z-10 max-h-[80vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[26px] border border-border bg-surface pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] shadow-xl sm:max-h-[85vh] sm:rounded-[26px]"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[1.05rem] font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[0.75rem] text-ink-faint">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ground-alt text-ink-soft"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
