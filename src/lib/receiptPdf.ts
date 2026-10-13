import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatShortDate } from "@/lib/format";
import { paymentModeLabels } from "@/lib/payment";
import {
  formatINRForPdf as formatINR,
  numberToIndianWords,
  PDF_BRAND_RGB as BRAND_RGB,
  PDF_FAINT_RGB as FAINT_RGB,
  PDF_INK_RGB as INK_RGB,
} from "@/lib/pdfFormat";
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
}

/** "11 Oct 2026" -> "111026", for a compact reference code. */
function compactDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}${mm}${yy}`;
}

/**
 * A one-page PDF receipt for a single contribution — "GV Durga Puja
 * Committee received Rs. X from <payer>, via <mode>, on <date>" — built
 * client-side and shared the same way as the Funds-tab audit report (Web
 * Share API on a phone, otherwise a direct download).
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
  const marginX = 16;
  const boxTop = 16;
  const boxWidth = pageWidth - marginX * 2;
  let y = boxTop + 14;

  // --- Header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...BRAND_RGB);
  doc.text("GV DURGA PUJA COMMITTEE", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK_RGB);
  doc.text("Receipt of Contribution", pageWidth / 2, y, { align: "center" });
  y += 5.5;
  doc.setFontSize(9);
  doc.setTextColor(...FAINT_RGB);
  doc.text(`Durga Puja Celebration ${year.year}`, pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 9;

  // --- Reference / date ---
  doc.setFontSize(9.5);
  doc.setTextColor(...FAINT_RGB);
  doc.text(`Reference: ${reference}`, marginX, y);
  doc.text(`Date: ${formatShortDate(payment.paymentDate)}, ${year.year}`, pageWidth - marginX, y, {
    align: "right",
  });
  y += 9;

  // --- Payer ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...FAINT_RGB);
  doc.text("Received with thanks from", marginX, y);
  y += 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK_RGB);
  doc.text(payer.name, marginX, y);
  if (payer.context) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...FAINT_RGB);
    doc.text(payer.context, marginX, y + 5);
    y += 5;
  }
  y += 10;

  // --- Amount + breakdown ---
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
  rows.push(["Towards", `Durga Puja Celebration ${year.year}`]);
  if (payment.collectorName) {
    rows.push(["Received by", `${payment.collectorName}, on behalf of GV Durga Puja Committee`]);
  }

  autoTable(doc, {
    startY: y,
    theme: "plain",
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 }, 1: {} },
    body: rows,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  // --- Signature block ---
  const sigX = pageWidth - marginX - 60;
  doc.setDrawColor(...FAINT_RGB);
  doc.setLineWidth(0.3);
  doc.line(sigX, y, pageWidth - marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...FAINT_RGB);
  doc.text("For GV Durga Puja Committee", pageWidth - marginX, y, { align: "right" });

  // --- Outer border, drawn last so it frames everything above ---
  const boxBottom = y + 10;
  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.8);
  doc.roundedRect(marginX - 6, boxTop, boxWidth + 12, boxBottom - boxTop, 3, 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...FAINT_RGB);
  doc.text(
    "This is a system-generated receipt from the GV Durga Puja app.",
    pageWidth / 2,
    boxBottom + 8,
    { align: "center" },
  );

  const filename = `Receipt - ${payer.name} - GV Durga Puja ${year.year}.pdf`;
  const blob = doc.output("blob");

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (nav.canShare && nav.share) {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({
          files: [file],
          title: filename,
          text: `Receipt for ${payer.name} — GV Durga Puja ${year.year}`,
        });
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
