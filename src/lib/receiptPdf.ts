import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatShortDate, today } from "@/lib/format";
import { paymentModeLabels } from "@/lib/payment";
import { formatINRForPdf as formatINR, numberToIndianWords } from "@/lib/pdfFormat";
import type { PaymentMode, PujaYear } from "@/lib/types";

export interface ReceiptPayer {
  name: string;
  /** Shown under the name — e.g. "A-101 · Owner", "Ex Resident", "Stall · Gate 2". */
  context?: string;
  /** Short, stable code this payer is known by — used to build the reference (no running counter; see generateReceiptPdf's doc comment). */
  refCode: string;
}

export interface ReceiptPaymentDetails {
  /** What's actually been received so far — never a pledge/promise amount. */
  moneyAmount: number;
  bhogGroceryAmount: number;
  /** Never "pending" — the caller only offers a receipt once something has actually been received. */
  paymentMode: PaymentMode;
  paymentDate: string;
  collectorName?: string;
  /**
   * Set only for a part-payment against a larger pledge (status "partial"
   * with a recorded original pledge) — moneyAmount is what's been received so
   * far, this is the full amount they committed to, and the receipt shows
   * both plus the gap still pending, rather than looking like a full
   * settlement.
   */
  originalPledgeAmount?: number;
  /** Shown on the "Towards" row instead of the generic "Durga Puja Celebration <year>" — e.g. a Dandiya Night Pass's people/night breakdown. */
  towardsOverride?: string;
  /** Shown as the document's title instead of the generic "Receipt of Contribution" — e.g. "Dandiya Night Pass". */
  slipTitle?: string;
}

/** Either a specific pledge still owed ("promised") or a plain, no-figure ask ("pending" — nothing's been discussed yet). */
export type ContributionRequestDetails =
  | { kind: "promised"; pledgedAmount: number }
  | { kind: "pending" };

/** "11 Oct 2026" -> "111026", for a compact reference code. */
function compactDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}${mm}${yy}`;
}

// Navy/indigo, matching the committee's real printed Donation Slip booklet —
// kept local to this file (not pdfFormat.ts's shared brand color, which the
// Funds-tab audit report still uses its own maroon for).
const BRAND_RGB: [number, number, number] = [36, 52, 125];
const FAINT_RGB: [number, number, number] = [100, 108, 150];
const INK_RGB: [number, number, number] = [25, 25, 35];

const PAGE_MARGIN_X = 16;
const BOX_TOP = 16;

// The Durga Maa crest cropped from the committee's own reference slip —
// public/durga-logo.png, ~128x166px (w:h ≈ 1:1.30). Fetched once and cached
// as raw bytes so every PDF generated in this session re-embeds the same
// buffer instead of re-fetching.
const LOGO_ASPECT = 166 / 128;
let logoBytesPromise: Promise<Uint8Array | null> | null = null;
function loadLogo(): Promise<Uint8Array | null> {
  logoBytesPromise ??= fetch("/durga-logo.png")
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .then((buf) => (buf ? new Uint8Array(buf) : null))
    .catch(() => null);
  return logoBytesPromise;
}

// public/gv-seal.png — a drawn circular committee seal (double ring, curved
// "GANGA VERTICA CELEBRATES" / "DURGA PUJA COMMITTEE", "GV" center emblem),
// square (1:1). The year isn't baked into the image — it's drawn separately
// as text over the image's blank center, so one asset works for every year.
let sealBytesPromise: Promise<Uint8Array | null> | null = null;
function loadSeal(): Promise<Uint8Array | null> {
  sealBytesPromise ??= fetch("/gv-seal.png")
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .then((buf) => (buf ? new Uint8Array(buf) : null))
    .catch(() => null);
  return sealBytesPromise;
}

/** Draws the shared letterhead (Durga Maa crest, society name, subtitle, year, divider) every generated document opens with. Returns the y cursor just below the divider. */
async function drawLetterhead(
  doc: jsPDF,
  pageWidth: number,
  subtitle: string,
  year: PujaYear,
): Promise<number> {
  let y = BOX_TOP + 14;
  const logo = await loadLogo();

  const title = "Ganga Vertica Celebrates Durga Puja";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const titleWidth = doc.getTextWidth(title);
  const logoW = 11;
  const logoH = logoW * LOGO_ASPECT;
  const gap = 3;
  const blockWidth = logo ? logoW + gap + titleWidth : titleWidth;
  const startX = pageWidth / 2 - blockWidth / 2;

  if (logo) {
    try {
      doc.addImage(logo, "PNG", startX, y - logoH + 5, logoW, logoH);
    } catch {
      // A broken/unreachable image shouldn't block the rest of the document —
      // the letterhead just falls back to text-only below.
    }
  }
  doc.setTextColor(...BRAND_RGB);
  doc.text(title, logo ? startX + logoW + gap : pageWidth / 2, y, {
    align: logo ? "left" : "center",
  });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK_RGB);
  doc.text(subtitle, pageWidth / 2, y, { align: "center" });
  y += 5.5;
  doc.setFontSize(9);
  doc.setTextColor(...FAINT_RGB);
  doc.text(`Durga Puja Celebration ${year.year}`, pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.6);
  doc.line(PAGE_MARGIN_X, y, pageWidth - PAGE_MARGIN_X, y);
  return y + 9;
}

/** Reference line (left) and date (right), just under the letterhead. Returns the y cursor below it. */
function drawReferenceLine(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  reference: string,
  dateLabel: string,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...FAINT_RGB);
  doc.text(`Reference: ${reference}`, PAGE_MARGIN_X, y);
  doc.text(dateLabel, pageWidth - PAGE_MARGIN_X, y, { align: "right" });
  return y + 9;
}

/** The payer's name block — a lead-in line, the bold name, and an optional faint context line. Returns the y cursor below it. */
function drawPayerBlock(doc: jsPDF, y: number, leadIn: string, payer: ReceiptPayer): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...FAINT_RGB);
  doc.text(leadIn, PAGE_MARGIN_X, y);
  y += 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK_RGB);
  doc.text(payer.name, PAGE_MARGIN_X, y);
  if (payer.context) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...FAINT_RGB);
    doc.text(payer.context, PAGE_MARGIN_X, y + 5);
    y += 5;
  }
  return y + 10;
}

/**
 * A round committee seal (no signature — this is a digital document, a
 * stamp reads as authoritative without needing a hand signature) + the
 * bordered frame around everything + the small footer note, drawn last so
 * the frame encloses the whole page.
 */
async function closeDocumentFrame(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  year: number,
  footerNote: string,
): Promise<void> {
  const seal = await loadSeal();
  const sealSize = 26;
  const sealX = pageWidth - PAGE_MARGIN_X - sealSize;
  const sealY = y;

  if (seal) {
    try {
      doc.addImage(seal, "PNG", sealX, sealY, sealSize, sealSize);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...BRAND_RGB);
      doc.text(String(year), sealX + sealSize / 2, sealY + sealSize / 2 + 7.5, { align: "center" });
    } catch {
      // A broken/unreachable seal image shouldn't block the rest of the
      // document — it just won't have a seal.
    }
  }

  const boxBottom = sealY + sealSize + 6;
  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.8);
  doc.roundedRect(
    PAGE_MARGIN_X - 6,
    BOX_TOP,
    pageWidth - PAGE_MARGIN_X * 2 + 12,
    boxBottom - BOX_TOP,
    3,
    3,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...FAINT_RGB);
  doc.text(footerNote, pageWidth / 2, boxBottom + 8, { align: "center" });
}

/** Shares the finished PDF via the Web Share API when available (phone), otherwise downloads it directly — same fallback used by the Funds-tab audit report. */
async function shareOrDownloadPdf(
  doc: jsPDF,
  filename: string,
  shareTitle: string,
  shareText: string,
): Promise<void> {
  const blob = doc.output("blob");

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (nav.canShare && nav.share) {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: shareTitle, text: shareText });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * A one-page PDF receipt for a single contribution — "Ganga Vertica
 * Celebrates Durga Puja received Rs. X from <payer>, via <mode>, on
 * <date>" — built client-side and shared the same way as the Funds-tab
 * audit report (Web Share API on a phone, otherwise a direct download).
 *
 * No permanent sequential receipt number is kept (that would need a counter
 * persisted in Supabase); instead each receipt's reference combines the
 * payer's own code with the payment date, which is unique enough for a
 * payer who — as is the norm here — pays once a year, without needing any
 * schema change.
 */
export async function generateReceiptPdf(
  payer: ReceiptPayer,
  payment: ReceiptPaymentDetails,
  year: PujaYear,
): Promise<void> {
  const totalAmount = payment.moneyAmount + payment.bhogGroceryAmount;
  const reference = `GVDP/${payer.refCode}/${compactDate(payment.paymentDate)}`;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = await drawLetterhead(doc, pageWidth, payment.slipTitle ?? "Receipt of Contribution", year);
  y = drawReferenceLine(doc, pageWidth, y, reference, `Date: ${formatShortDate(payment.paymentDate)}, ${year.year}`);
  y = drawPayerBlock(doc, y, "Received with thanks from", payer);

  const isPartPayment =
    payment.originalPledgeAmount != null && payment.originalPledgeAmount > payment.moneyAmount;

  const rows: (string | number)[][] = [];
  if (isPartPayment) {
    rows.push(["Total amount pledged", formatINR(payment.originalPledgeAmount!)]);
  }
  if (payment.moneyAmount > 0 && payment.bhogGroceryAmount > 0) {
    rows.push(["Cash / UPI contribution", formatINR(payment.moneyAmount)]);
    rows.push(["Bhog & groceries (in-kind)", formatINR(payment.bhogGroceryAmount)]);
  }
  rows.push([isPartPayment ? "Amount received now" : "Amount received", formatINR(totalAmount)]);
  rows.push(["In words", `Rupees ${numberToIndianWords(totalAmount)} Only`]);
  if (isPartPayment) {
    rows.push(["Balance pending", formatINR(payment.originalPledgeAmount! - payment.moneyAmount)]);
  }
  if (payment.moneyAmount > 0) {
    rows.push(["Payment mode", paymentModeLabels[payment.paymentMode]]);
  }
  rows.push(["Towards", payment.towardsOverride ?? `Durga Puja Celebration ${year.year}`]);
  if (payment.collectorName) {
    rows.push(["Received by", `${payment.collectorName}, on behalf of GV Durga Puja Committee`]);
  }

  autoTable(doc, {
    startY: y,
    theme: "plain",
    margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
    styles: { fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 }, 1: {} },
    body: rows,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  await closeDocumentFrame(doc, pageWidth, y, year.year, "This is a system-generated receipt from the GV Durga Puja app.");

  const titlePrefix = payment.slipTitle ?? "Receipt";
  const filename = `${titlePrefix} - ${payer.name} - GV Durga Puja ${year.year}.pdf`;
  await shareOrDownloadPdf(
    doc,
    filename,
    filename,
    `${titlePrefix} for ${payer.name} — GV Durga Puja ${year.year}`,
  );
}

/**
 * A one-page PDF request/reminder for a contribution that hasn't come in
 * yet — "promised" shows the pledged figure still owed, "pending" (nothing
 * discussed yet) is a plain, no-figure ask. Shared the same way as a
 * receipt (Web Share API on a phone, otherwise a direct download).
 *
 * The chip that triggers this swaps to generateReceiptPdf automatically
 * once the status actually becomes paid/partial/bhog_only — both share the
 * same card-header slot, decided fresh from the contribution's current
 * status each render (see FlatCard.tsx's paymentActionChipFor).
 */
export async function generateContributionRequestPdf(
  payer: ReceiptPayer,
  request: ContributionRequestDetails,
  year: PujaYear,
): Promise<void> {
  const requestDate = today();
  const reference = `GVDP/${payer.refCode}/${compactDate(requestDate)}`;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = await drawLetterhead(doc, pageWidth, "Contribution Request", year);
  y = drawReferenceLine(doc, pageWidth, y, reference, `Date: ${formatShortDate(requestDate)}, ${year.year}`);
  y = drawPayerBlock(doc, y, "To", payer);

  const rows: (string | number)[][] =
    request.kind === "promised"
      ? [
          ["Amount pledged", formatINR(request.pledgedAmount)],
          ["In words", `Rupees ${numberToIndianWords(request.pledgedAmount)} Only`],
          ["Status", "Payment pending"],
          ["Towards", `Durga Puja Celebration ${year.year}`],
        ]
      : [
          ["Status", "Contribution awaited"],
          ["Towards", `Durga Puja Celebration ${year.year}`],
        ];

  autoTable(doc, {
    startY: y,
    theme: "plain",
    margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
    styles: { fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 }, 1: {} },
    body: rows,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  const message =
    request.kind === "promised"
      ? "This is a gentle reminder of your kind pledge towards this year's Durga Puja celebration. We'd be grateful if you could complete the contribution at your convenience."
      : "We would be grateful for your kind contribution towards this year's Durga Puja celebration, in whatever amount you're comfortable with.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK_RGB);
  const wrapped = doc.splitTextToSize(message, pageWidth - PAGE_MARGIN_X * 2);
  doc.text(wrapped, PAGE_MARGIN_X, y);
  y += wrapped.length * 5 + 12;

  await closeDocumentFrame(doc, pageWidth, y, year.year, "This is a system-generated request from the GV Durga Puja app.");

  const filename = `Contribution Request - ${payer.name} - GV Durga Puja ${year.year}.pdf`;
  await shareOrDownloadPdf(
    doc,
    filename,
    filename,
    `Contribution request for ${payer.name} — GV Durga Puja ${year.year}`,
  );
}

export interface VendorPaymentReceiptDetails {
  amount: number;
  mode: PaymentMode;
  paymentDate: string;
  /** Name of the committee member who handed this over — omitted entirely when self-funded, since then it didn't come out of committee cash. */
  paidByName?: string;
  /** Paid from the member's own pocket (e.g. offsetting their own resident pledge), not committee cash. */
  selfFunded?: boolean;
  /** The bill's full amount and how much has been paid against it as of (and including) this payment, so the voucher can state what's still outstanding. */
  billTotal: number;
  billPaidToDate: number;
  note?: string;
}

/**
 * A one-page PDF payment voucher for a single payment made to a vendor —
 * "Paid to <vendor>, Rs. X, via <mode>, on <date>" — the outgoing-money
 * counterpart to generateReceiptPdf's incoming-contribution receipt. Same
 * letterhead/signature/share-or-download as the other documents in this
 * file.
 */
export async function generateVendorPaymentReceiptPdf(
  vendor: { name: string; serviceType: string; refCode: string },
  payment: VendorPaymentReceiptDetails,
  year: PujaYear,
): Promise<void> {
  const reference = `${vendor.refCode}/${compactDate(payment.paymentDate)}`;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = await drawLetterhead(doc, pageWidth, "Payment Voucher", year);
  y = drawReferenceLine(doc, pageWidth, y, reference, `Date: ${formatShortDate(payment.paymentDate)}, ${year.year}`);
  y = drawPayerBlock(doc, y, "Paid to", { name: vendor.name, context: vendor.serviceType, refCode: vendor.refCode });

  const balance = payment.billTotal - payment.billPaidToDate;
  const rows: (string | number)[][] = [
    ["Amount paid", formatINR(payment.amount)],
    ["In words", `Rupees ${numberToIndianWords(payment.amount)} Only`],
    ["Payment mode", paymentModeLabels[payment.mode]],
    ["Bill total", formatINR(payment.billTotal)],
    [balance > 0 ? "Balance outstanding" : "Bill status", balance > 0 ? formatINR(balance) : "Fully settled"],
    ["Towards", `Durga Puja Celebration ${year.year} — ${vendor.serviceType}`],
  ];
  if (payment.paidByName) {
    rows.push([
      "Paid by",
      payment.selfFunded
        ? `${payment.paidByName} (self-funded, not committee cash)`
        : `${payment.paidByName}, on behalf of GV Durga Puja Committee`,
    ]);
  }

  autoTable(doc, {
    startY: y,
    theme: "plain",
    margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
    styles: { fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 }, 1: {} },
    body: rows,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  await closeDocumentFrame(doc, pageWidth, y, year.year, "This is a system-generated payment voucher from the GV Durga Puja app.");

  const filename = `Payment Voucher - ${vendor.name} - GV Durga Puja ${year.year}.pdf`;
  await shareOrDownloadPdf(
    doc,
    filename,
    filename,
    `Payment voucher for ${vendor.name} — GV Durga Puja ${year.year}`,
  );
}
