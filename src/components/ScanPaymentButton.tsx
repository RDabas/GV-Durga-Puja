"use client";

import { useRef } from "react";
import { CameraIcon } from "@/components/icons";
import { parsePaymentScreenshot, type ScannedPayment } from "@/lib/scanPayment";
import { useAsyncAction } from "@/lib/useAsyncAction";

/**
 * A compact header-row button (sized to sit next to "+ Add bill") that lets
 * someone pick a payment screenshot — a fresh camera photo, or an existing
 * image saved/forwarded via WhatsApp into the gallery — and runs on-device
 * OCR over it to pull out an amount/date/mode. No `capture` attribute on
 * the file input on purpose: that would force the camera open and skip the
 * gallery, but phones already offer a "Camera / Photo Library" chooser on a
 * plain image input, covering both cases through one control. The image
 * itself is never uploaded or kept — it's read in the browser, scanned,
 * then discarded. The caller decides what to do with the result (e.g. ask
 * which bill it's for before opening the matching form pre-filled).
 */
export function ScanPaymentButton({
  onExtracted,
}: {
  onExtracted: (result: ScannedPayment) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { submitting: scanning, error, run } = useAsyncAction();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    run(async () => {
      const result = await parsePaymentScreenshot(file);
      onExtracted(result);
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={scanning}
        className="flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-[0.75rem] font-semibold text-brand active:scale-[0.98] disabled:opacity-60"
      >
        <CameraIcon className="h-[13px] w-[13px]" />
        {scanning ? "Scanning…" : "Scan payment"}
      </button>
      {error && <p className="mt-1.5 text-[0.75rem] text-critical">{error}</p>}
    </div>
  );
}
