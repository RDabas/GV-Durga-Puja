import type { PaymentMode } from "@/lib/types";

/**
 * Best-effort fields pulled from a payment screenshot via on-device OCR —
 * each left undefined when nothing confident was found, rather than
 * guessing. The caller pre-fills a form with these and the person reviews/
 * corrects them before saving; this is never meant to auto-submit.
 */
export interface ScannedPayment {
  amount?: number;
  paymentDate?: string;
  mode?: PaymentMode;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/** Local (not UTC) yyyy-mm-dd — same convention as today() in src/lib/format.ts. */
function toLocalIsoDate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Exported so these heuristics can be unit-tested/tuned against real sample OCR text independently of running OCR itself. */
export function extractAmount(text: string): number | undefined {
  const currencyPatterns = [
    /₹\s*([\d,]+(?:\.\d{1,2})?)/,
    /\bRs\.?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\bINR\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const pattern of currencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (!Number.isNaN(value) && value > 0) return value;
    }
  }

  // No currency symbol caught — fall back to a standalone number near a
  // payment-related keyword, short enough to not be a phone number or a
  // long UPI reference/transaction id. Matches either a comma-grouped number
  // ("1,234") or a plain run of up to 7 digits ("2000") — Indian amounts are
  // very often typed/OCR'd without comma grouping at all.
  const numberPattern = /\b\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?\b|\b\d{1,7}(?:\.\d{1,2})?\b/g;
  function numbersIn(line: string): number[] {
    return [...line.matchAll(numberPattern)]
      .map((m) => Number(m[0].replace(/,/g, "")))
      .filter((n) => !Number.isNaN(n) && n > 0);
  }

  const lines = text.split(/\r?\n/);
  const keywordPattern = /\b(paid|sent|amount|total|payment)\b/i;
  for (let i = 0; i < lines.length; i++) {
    if (!keywordPattern.test(lines[i])) continue;
    // Prefer numbers on the keyword's own line ("Amount paid 2000") over the
    // next line, so an adjacent date/reference-id line can't get mixed in —
    // only fall back to the next line for a label with no digits of its own
    // ("Amount Paid" on one line, "₹650" on the next).
    const ownLine = numbersIn(lines[i]);
    if (ownLine.length > 0) return Math.max(...ownLine);
    const nextLine = numbersIn(lines[i + 1] ?? "");
    if (nextLine.length > 0) return Math.max(...nextLine);
  }
  return undefined;
}

export function extractDate(text: string): string | undefined {
  const now = new Date();
  if (/\byesterday\b/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return toLocalIsoDate(d);
  }
  if (/\btoday\b/i.test(text)) {
    return toLocalIsoDate(now);
  }

  // "11 Oct 2026" / "11 October 2026"
  let match = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month !== undefined) {
      return toLocalIsoDate(new Date(Number(match[3]), month, Number(match[1])));
    }
  }

  // "Oct 11, 2026" / "October 11 2026"
  match = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    if (month !== undefined) {
      return toLocalIsoDate(new Date(Number(match[3]), month, Number(match[2])));
    }
  }

  // "11/10/2026" or "11-10-2026" — day/month/year, the Indian convention.
  match = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toLocalIsoDate(new Date(year, month - 1, day));
    }
  }

  return undefined;
}

export function extractMode(text: string): PaymentMode | undefined {
  if (/\b(upi|gpay|google pay|phonepe|paytm|bhim)\b/i.test(text)) return "upi";
  if (/\bcash\b/i.test(text)) return "cash";
  return undefined;
}

/**
 * Runs on-device OCR (tesseract.js, loaded lazily so it never bloats the
 * main bundle for the common no-scan path) over a payment screenshot and
 * pulls out whatever fields it can confidently find. Free and private
 * (nothing leaves the phone), at the cost of reliability — raw OCR text has
 * no understanding of a payment app's layout, so results are a starting
 * point to review, not a guarantee.
 */
export async function parsePaymentScreenshot(file: File): Promise<ScannedPayment> {
  const { recognize } = await import("tesseract.js");
  const result = await recognize(file, "eng");
  const text = result.data.text;
  return {
    amount: extractAmount(text),
    paymentDate: extractDate(text),
    mode: extractMode(text),
  };
}
