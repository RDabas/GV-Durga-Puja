"use client";

import { useRef, useState } from "react";
import { CameraIcon } from "@/components/icons";
import { parsePaymentScreenshot, type ScannedPayment } from "@/lib/scanPayment";

/**
 * Lets someone pick a payment screenshot — a fresh camera photo, or an
 * existing image saved/forwarded via WhatsApp into the gallery — and runs
 * on-device OCR over it to pull out an amount/date/mode. No `capture`
 * attribute on the file input on purpose: that would force the camera open
 * and skip the gallery, but phones already offer a "Camera / Photo
 * Library" chooser on a plain image input, covering both cases through one
 * control. The image itself is never uploaded or kept — it's read in the
 * browser, scanned, then discarded.
 */
export function ScanPaymentButton({
  onExtracted,
}: {
  onExtracted: (result: ScannedPayment) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanning(true);
    setError(null);
    try {
      const result = await parsePaymentScreenshot(file);
      onExtracted(result);
    } catch {
      setError("Couldn't read that image — fill in the details below instead.");
    } finally {
      setScanning(false);
    }
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
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-[0.82rem] font-semibold text-brand disabled:opacity-60"
      >
        <CameraIcon className="h-4 w-4" />
        {scanning ? "Scanning…" : "Scan payment screenshot"}
      </button>
      {error && <p className="mt-1.5 text-[0.75rem] text-critical">{error}</p>}
    </div>
  );
}
