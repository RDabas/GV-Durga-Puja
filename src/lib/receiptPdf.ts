import { jsPDF } from "jspdf";
import { formatShortDate, today } from "@/lib/format";
import { formatINRForPdf as formatINR, numberToIndianWords } from "@/lib/pdfFormat";
import type { PaymentMode, PujaYear } from "@/lib/types";

export interface ReceiptPayer {
  name: string;
  /** Shown under the name — e.g. "A-101 · Owner", "Ex Resident", "Stall · Gate 2". */
  context?: string;
  /** Short, stable code this payer is known by — used to build the "No." reference (no running counter; see generateReceiptPdf's doc comment). */
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
  /** Shown on the "towards" line instead of the generic "Durga Pooja" — e.g. a Dandiya Night Pass's people/night breakdown. */
  towardsOverride?: string;
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

// Matches the committee's real printed "Donation Slip" booklet — a navy/
// indigo ink on a bordered slip, not the app's own maroon brand color.
const SLIP_BLUE: [number, number, number] = [36, 52, 125];
const SLIP_FAINT: [number, number, number] = [100, 108, 150];
const SLIP_INK: [number, number, number] = [25, 25, 35];

const PAGE_MARGIN_X = 16;
const BOX_TOP = 16;

/** The letterhead every generated slip opens with — society name, address, divider, and the slip's title. Returns the y cursor below it. */
function drawLetterhead(doc: jsPDF, pageWidth: number, title: string): number {
  let y = BOX_TOP + 13;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...SLIP_BLUE);
  doc.text("Ganga Vertica Celebrates", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFont("times", "bolditalic");
  doc.setFontSize(14);
  doc.text("Durga Puja", pageWidth / 2, y, { align: "center" });
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLIP_FAINT);
  doc.text(
    "Ganga Vertica Apartment, Neeladri Road, Electronic City Phase 1, Bengaluru - 560 100.",
    pageWidth / 2,
    y,
    { align: "center" },
  );
  y += 6;

  doc.setDrawColor(...SLIP_BLUE);
  doc.setLineWidth(0.6);
  doc.line(PAGE_MARGIN_X, y, pageWidth - PAGE_MARGIN_X, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...SLIP_INK);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  const titleWidth = doc.getTextWidth(title);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - titleWidth / 2, y + 1.3, pageWidth / 2 + titleWidth / 2, y + 1.3);
  return y + 10;
}

/** "No. [ref]" (left) and "Date: [date]" (right), like the slip's top row. Returns the y cursor below it. */
function drawNoAndDateRow(doc: jsPDF, pageWidth: number, y: number, reference: string, dateLabel: string): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...SLIP_INK);
  doc.text(`No. ${reference}`, PAGE_MARGIN_X, y);
  doc.text(dateLabel, pageWidth - PAGE_MARGIN_X, y, { align: "right" });
  return y + 9;
}

/** The "Received with thanks the sum of Rupees ... Only" line, with the words sitting on their own underlined blank, same as the slip. Returns the y cursor below it. */
function drawAmountInWordsLine(doc: jsPDF, pageWidth: number, y: number, words: string): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...SLIP_INK);
  doc.text("Received with thanks the sum of Rupees", PAGE_MARGIN_X, y);
  y += 6.5;
  doc.setFont("helvetica", "bold");
  doc.text(words, PAGE_MARGIN_X, y);
  doc.setDrawColor(...SLIP_FAINT);
  doc.setLineWidth(0.25);
  doc.line(PAGE_MARGIN_X, y + 1.5, pageWidth - PAGE_MARGIN_X, y + 1.5);
  return y + 9;
}

/** "Smt/Shri [Name]" (or just the name for a non-individual payer) plus an optional faint context line. Returns the y cursor below it. */
function drawPayerLine(doc: jsPDF, pageWidth: number, y: number, payer: ReceiptPayer, honorific: boolean): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...SLIP_INK);
  doc.text(`${honorific ? "Smt/Shri " : ""}${payer.name}`, PAGE_MARGIN_X, y);
  doc.setDrawColor(...SLIP_FAINT);
  doc.setLineWidth(0.25);
  doc.line(PAGE_MARGIN_X, y + 1.5, pageWidth - PAGE_MARGIN_X, y + 1.5);
  y += 6;
  if (payer.context) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SLIP_FAINT);
    doc.text(payer.context, PAGE_MARGIN_X, y);
    y += 5;
  }
  return y + 4;
}

/** The slip's closing "Rs. [amount]" / "Signature" row, the bordered frame around everything, and a small footer note. Returns nothing — this is always the last thing drawn. */
function closeSlip(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  amountLabel: string | undefined,
  footerNote: string,
): void {
  if (amountLabel) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...SLIP_INK);
    doc.text(amountLabel, PAGE_MARGIN_X, y);
  }
  const sigX = pageWidth - PAGE_MARGIN_X - 45;
  doc.setDrawColor(...SLIP_FAINT);
  doc.setLineWidth(0.3);
  doc.line(sigX, y, pageWidth - PAGE_MARGIN_X, y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...SLIP_FAINT);
  doc.text("Signature", pageWidth - PAGE_MARGIN_X, y + 5, { align: "right" });
  y += 5;

  const boxBottom = y + 10;
  doc.setDrawColor(...SLIP_BLUE);
  doc.setLineWidth(0.9);
  doc.roundedRect(
    PAGE_MARGIN_X - 6,
    BOX_TOP,
    pageWidth - PAGE_MARGIN_X * 2 + 12,
    boxBottom - BOX_TOP,
    3,
    3,
  );
  doc.setLineWidth(0.3);
  doc.roundedRect(
    PAGE_MARGIN_X - 4,
    BOX_TOP + 2,
    pageWidth - PAGE_MARGIN_X * 2 + 8,
    boxBottom - BOX_TOP - 4,
    2,
    2,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLIP_FAINT);
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
 * A one-page PDF "Donation Slip" for a single contribution, matching the
 * committee's real printed slip booklet (society letterhead, No./Date row,
 * "Received with thanks the sum of Rupees ...", name, amount, signature) —
 * built client-side and shared the same way as the Funds-tab audit report
 * (Web Share API on a phone, otherwise a direct download).
 *
 * No permanent sequential slip number is kept (that would need a counter
 * persisted in Supabase, unlike the physical booklet's pre-printed numbers);
 * instead each slip's "No." combines the payer's own code with the payment
 * date, which is unique enough for a payer who — as is the norm here — pays
 * once a year, without needing any schema change.
 */
export async function generateReceiptPdf(
  payer: ReceiptPayer,
  payment: ReceiptPaymentDetails,
  year: PujaYear,
  honorific = true,
): Promise<void> {
  const totalAmount = payment.moneyAmount + payment.bhogGroceryAmount;
  const reference = `${payer.refCode}/${compactDate(payment.paymentDate)}`;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawLetterhead(doc, pageWidth, "DONATION SLIP");
  y = drawNoAndDateRow(doc, pageWidth, y, reference, `Date: ${formatShortDate(payment.paymentDate)}, ${year.year}`);
  y = drawAmountInWordsLine(doc, pageWidth, y, `${numberToIndianWords(totalAmount)} Only`);
  y = drawPayerLine(doc, pageWidth, y, payer, honorific);

  const isPartPayment =
    payment.originalPledgeAmount != null && payment.originalPledgeAmount > payment.moneyAmount;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...SLIP_INK);
  doc.text(`towards ${payment.towardsOverride ?? "Durga Pooja"}`, PAGE_MARGIN_X, y);
  y += 7;

  if (isPartPayment) {
    doc.setFontSize(8.5);
    doc.setTextColor(...SLIP_FAINT);
    doc.text(
      `Pledged ${formatINR(payment.originalPledgeAmount!)} · balance pending ${formatINR(payment.originalPledgeAmount! - payment.moneyAmount)}`,
      PAGE_MARGIN_X,
      y,
    );
    y += 6;
  }
  if (payment.moneyAmount > 0 && payment.bhogGroceryAmount > 0) {
    doc.setFontSize(8.5);
    doc.setTextColor(...SLIP_FAINT);
    doc.text(
      `Cash/UPI ${formatINR(payment.moneyAmount)} + Bhog & groceries (in-kind) ${formatINR(payment.bhogGroceryAmount)}`,
      PAGE_MARGIN_X,
      y,
    );
    y += 6;
  }
  y += 6;

  closeSlip(doc, pageWidth, y, formatINR(totalAmount), "System-generated via the GV Durga Puja app.");

  const filename = `Donation Slip - ${payer.name} - GV Durga Puja ${year.year}.pdf`;
  await shareOrDownloadPdf(
    doc,
    filename,
    filename,
    `Donation slip for ${payer.name} — GV Durga Puja ${year.year}`,
  );
}

/**
 * A one-page PDF request/reminder for a contribution that hasn't come in
 * yet — "promised" shows the pledged figure still owed, "pending" (nothing
 * discussed yet) is a plain, no-figure ask. Same letterhead/style as
 * generateReceiptPdf, shared the same way (Web Share API on a phone,
 * otherwise a direct download).
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
  honorific = true,
): Promise<void> {
  const requestDate = today();
  const reference = `${payer.refCode}/${compactDate(requestDate)}`;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawLetterhead(doc, pageWidth, "CONTRIBUTION REQUEST");
  y = drawNoAndDateRow(doc, pageWidth, y, reference, `Date: ${formatShortDate(requestDate)}, ${year.year}`);
  y = drawPayerLine(doc, pageWidth, y, payer, honorific);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...SLIP_INK);
  const message =
    request.kind === "promised"
      ? `A gentle reminder of your kind pledge of ${formatINR(request.pledgedAmount)} (${numberToIndianWords(request.pledgedAmount)} Only) towards this year's Durga Puja celebration — we'd be grateful if you could complete it at your convenience.`
      : "We would be grateful for your kind contribution towards this year's Durga Puja celebration, in whatever amount you're comfortable with.";
  const wrapped = doc.splitTextToSize(message, pageWidth - PAGE_MARGIN_X * 2);
  doc.text(wrapped, PAGE_MARGIN_X, y);
  y += wrapped.length * 5 + 10;

  closeSlip(doc, pageWidth, y, undefined, "System-generated via the GV Durga Puja app.");

  const filename = `Contribution Request - ${payer.name} - GV Durga Puja ${year.year}.pdf`;
  await shareOrDownloadPdf(
    doc,
    filename,
    filename,
    `Contribution request for ${payer.name} — GV Durga Puja ${year.year}`,
  );
}
