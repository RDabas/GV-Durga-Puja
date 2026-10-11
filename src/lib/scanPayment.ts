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

// Only real month names — not just "any 3-9 letter word" — so a line like
// "+91 wen 4141" (OCR mangling the bullet-masked digits of a phone number
// into letters) can't accidentally shape-match "<day> <word> <year>" and get
// stripped as if it were a date, silently eating a real number from the
// amount search. Longest-first so "sept" matches before "sep" would cut it
// short.
const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

// Date/time substrings get stripped out before amount-candidate scanning
// (see extractAmount) so a day/year/hour never gets mistaken for an amount —
// kept in sync with the date patterns extractDate itself matches. Anchored
// to real month names (not just letter-shape) for the same reason as above.
const DATE_LIKE_PATTERNS = [
  new RegExp(`\\b\\d{1,2}\\s+(?:${MONTH_PATTERN})\\s+\\d{4}\\b`, "gi"), // "11 October 2026"
  new RegExp(`\\b(?:${MONTH_PATTERN})\\s+\\d{1,2},?\\s+\\d{4}\\b`, "gi"), // "Oct 11, 2026"
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, // "11/10/2026"
  /\b\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?\b/gi, // "2:30pm" / "2:30 PM"
];

// A number found on a line matching any of these shouldn't be treated as the
// payment amount — reference/transaction ids, account/phone numbers, and
// anything shown with masked digits ("•••• 4141") are not amounts, even
// though they're often the most prominent-looking numbers on the screen.
// PHONE_PREFIX_LINE catches a phone number even when OCR mangles its masked
// bullets into letters (so MASKED_NUMBER alone would miss it) — a line
// starting "+91 ..." is never a payment amount.
const DISQUALIFYING_LINE = /\b(id|reference|ref\.?\s*no|utr|a\/?c|account|phone|mobile|bank)\b/i;
const MASKED_NUMBER = /[•*]{2,}/;
const PHONE_PREFIX_LINE = /^\s*\+\d{1,3}\b/;

/** Exported so these heuristics can be unit-tested/tuned against real sample OCR text independently of running OCR itself. */
export function extractAmount(text: string): number | undefined {
  // The ₹ symbol is a relatively rare glyph for a general-purpose English
  // OCR model and is frequently misread or dropped entirely — when it does
  // come through cleanly, though, it's the most reliable signal, so it's
  // still tried first.
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

  // No currency symbol caught — payment-app vocabulary varies too much to
  // rely on a fixed keyword list ("Completed"/"Pay again"/"To:"/"From:" on a
  // GPay receipt have no "paid"/"amount"/"total" anywhere). Instead: strip
  // out anything date/time-shaped so it can't be mistaken for an amount,
  // skip lines that are clearly an id/account/phone/masked number, and from
  // whatever's left prefer a comma-grouped number ("1,250" — a strong
  // currency signal) or otherwise the earliest one on screen, since payment
  // apps overwhelmingly show the amount as the first prominent figure, well
  // above any reference/transaction details further down.
  let cleaned = text;
  for (const pattern of DATE_LIKE_PATTERNS) cleaned = cleaned.replace(pattern, " ");

  const numberPattern = /\b\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?\b|\b\d{1,7}(?:\.\d{1,2})?\b/g;
  const candidates: { value: number; grouped: boolean; index: number }[] = [];
  cleaned.split(/\r?\n/).forEach((line, index) => {
    if (DISQUALIFYING_LINE.test(line) || MASKED_NUMBER.test(line) || PHONE_PREFIX_LINE.test(line)) {
      return;
    }
    for (const m of line.matchAll(numberPattern)) {
      const value = Number(m[0].replace(/,/g, ""));
      if (Number.isNaN(value) || value <= 0) continue;
      candidates.push({ value, grouped: m[0].includes(","), index });
    }
  });
  if (candidates.length === 0) return undefined;
  const grouped = candidates.filter((c) => c.grouped);
  const pool = grouped.length > 0 ? grouped : candidates;
  pool.sort((a, b) => a.index - b.index);
  return pool[0].value;
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
  let match = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\b`, "i"));
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month !== undefined) {
      return toLocalIsoDate(new Date(Number(match[3]), month, Number(match[1])));
    }
  }

  // "Oct 11, 2026" / "October 11 2026"
  match = text.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i"));
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
 *
 * Uses PSM.SPARSE_TEXT rather than the default page-segmentation mode —
 * payment-app screenshots are a handful of isolated, wildly different-sized
 * text blocks surrounded by whitespace (a huge amount, a tiny masked phone
 * number, a label, a logo), closer to "scattered text in no particular
 * order" than the uniform paragraph the default mode assumes. Verified
 * directly against real screenshots during development: the default mode
 * dropped the amount entirely on a cluttered "payment completed" detail
 * screen (too low-confidence against the surrounding layout) where
 * SPARSE_TEXT recovered it correctly.
 */
export async function parsePaymentScreenshot(file: File): Promise<ScannedPayment> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
  let text: string;
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const result = await worker.recognize(file);
    text = result.data.text;
  } finally {
    await worker.terminate();
  }
  return {
    amount: extractAmount(text),
    paymentDate: extractDate(text),
    mode: extractMode(text),
  };
}
