import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PujaStore } from "@/lib/store";
import { committeeBalances } from "@/lib/balances";
import { formatShortDate, today } from "@/lib/format";
import type { OutsideCollectionType } from "@/lib/types";

// jsPDF's standard fonts (Helvetica/Times/Courier) use WinAnsiEncoding,
// which has no glyph for ₹ — it silently renders as a stray quote mark
// instead. Embedding a custom font just for one glyph isn't worth the extra
// weight, so the PDF spells out "Rs." instead of using formatINR's ₹ symbol.
const inrNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
function formatINR(amount: number): string {
  return `Rs. ${inrNumber.format(amount)}`;
}

// Same maroon as --brand in globals.css (light theme) — jsPDF needs a raw
// RGB triple, not a CSS var, so it's duplicated here rather than shared.
const BRAND_RGB: [number, number, number] = [140, 39, 67];
const INK_RGB: [number, number, number] = [30, 30, 30];
const FAINT_RGB: [number, number, number] = [110, 110, 110];

const outsideCollectionTypeLabels: Record<OutsideCollectionType, string> = {
  outsider: "Outsider",
  donation: "Donation",
  donation_box: "Donation Box",
  stall: "Stall",
  dandiya_collection: "Dandiya Collection",
  promotion: "Promotion",
};

function dateRangeLabel(startISO: string, endISO: string): string {
  return `Shashthi ${formatShortDate(startISO)} – Dashami ${formatShortDate(endISO)}`;
}

/** Where jspdf-autotable leaves off, read back via its own (untyped-in-.d.ts) runtime property. */
function lastTableBottom(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function sectionHeading(doc: jsPDF, text: string, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...INK_RGB);
  doc.text(text, x, y);
  return y + 5;
}

/**
 * A one-glance, audit-style PDF summary suitable for sharing with residents
 * or the wider society committee — overall totals, category breakdowns, and
 * who's currently holding what — distinct from the full line-item Excel
 * export (src/lib/export.ts). Built entirely client-side; on a phone that
 * supports the Web Share API, it hands off straight to the share sheet
 * (WhatsApp, email, etc.) instead of just downloading.
 */
export async function generateAuditReportPdf(store: PujaStore): Promise<void> {
  const {
    activeYear,
    contributions,
    outsideCollections,
    vendorExpenses,
    members,
    carriedFunds,
    fundTransfers,
    contributionFor,
  } = store;

  const balances = committeeBalances(
    members,
    contributions,
    fundTransfers,
    vendorExpenses,
    carriedFunds,
  );

  const totalHouses = balances.reduce((s, b) => s + b.collected, 0);
  const totalOutside = balances.reduce((s, b) => s + b.outsideCollectionReceived, 0);
  const totalCollected = totalHouses + totalOutside;
  const totalCarriedIn = balances.reduce(
    (s, b) => s + b.carriedCash + b.carriedFd + b.carriedBank,
    0,
  );
  const totalVendorPaidFromCommittee = balances.reduce((s, b) => s + b.vendorPaid, 0);
  const totalBalanceInHand = balances.reduce((s, b) => s + b.balanceInHand, 0);

  const cashTotal = balances.reduce((s, b) => s + (b.collectedByMode.cash ?? 0), 0);
  const upiTotal = balances.reduce((s, b) => s + (b.collectedByMode.upi ?? 0), 0);

  // Vendor spend by category (serviceType is free text, entered per bill) —
  // paid here includes self-funded payments too, since the question is
  // "how much of the bill is settled," not "how much came from committee
  // cash" (that distinction only matters for balances.ts's vendorPaid).
  const categoryTotals = new Map<string, { billed: number; paid: number }>();
  for (const e of vendorExpenses) {
    const key = e.vendor.serviceType.trim() || "Other";
    const paid = e.payments.reduce((s, p) => s + p.amount, 0);
    const existing = categoryTotals.get(key) ?? { billed: 0, paid: 0 };
    categoryTotals.set(key, { billed: existing.billed + e.totalAmount, paid: existing.paid + paid });
  }
  const totalBilled = vendorExpenses.reduce((s, e) => s + e.totalAmount, 0);
  const totalPaidAgainstBills = [...categoryTotals.values()].reduce((s, c) => s + c.paid, 0);

  // Outside-collection amount actually received, by type.
  const outsideTotals = new Map<string, number>();
  for (const oc of outsideCollections) {
    const c = contributionFor({ outsideCollectionId: oc.id });
    if (!c || c.paymentMode === "pending" || c.moneyAmount <= 0) continue;
    const key = outsideCollectionTypeLabels[oc.type];
    outsideTotals.set(key, (outsideTotals.get(key) ?? 0) + c.moneyAmount);
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_RGB);
  doc.text("GV Durga Puja", marginX, y);
  y += 7;
  doc.setFontSize(13);
  doc.text(`Financial Summary — ${activeYear.year}`, marginX, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...FAINT_RGB);
  doc.text(dateRangeLabel(activeYear.shashthiDate, activeYear.dashamiDate), marginX, y);
  doc.text(`Generated ${formatShortDate(today())}`, pageWidth - marginX, y, { align: "right" });
  y += 7;

  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  // --- Overview ---
  y = sectionHeading(doc, "Overview", marginX, y);
  autoTable(doc, {
    startY: y,
    theme: "plain",
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 10, cellPadding: 1.4 },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
    body: [
      ["Total collected (houses + outside)", formatINR(totalCollected)],
      ["   from houses", formatINR(totalHouses)],
      ["   from outside collection", formatINR(totalOutside)],
      ["Carried over from previous year", formatINR(totalCarriedIn)],
      ["Paid to vendors (from committee funds)", formatINR(totalVendorPaidFromCommittee)],
      ["Balance currently in hand (all members)", formatINR(totalBalanceInHand)],
    ],
  });
  y = lastTableBottom(doc) + 8;

  // --- Payment mode split ---
  y = sectionHeading(doc, "By payment mode", marginX, y);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: marginX, right: marginX },
    head: [["Mode", "Amount"]],
    headStyles: { fillColor: BRAND_RGB, textColor: 255, fontSize: 9.5 },
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 1: { halign: "right" } },
    body: [
      ["Cash", formatINR(cashTotal)],
      ["UPI", formatINR(upiTotal)],
    ],
  });
  y = lastTableBottom(doc) + 8;

  // --- Who's holding the money ---
  y = sectionHeading(doc, "Who's holding the money", marginX, y);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: marginX, right: marginX },
    head: [["Member", "Houses", "Outside", "Spent", "Balance in hand"]],
    headStyles: { fillColor: BRAND_RGB, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9.5, cellPadding: 2 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
    },
    body: balances.map((b) => [
      b.member.name,
      formatINR(b.collected),
      formatINR(b.outsideCollectionReceived),
      formatINR(b.vendorPaid),
      formatINR(b.balanceInHand),
    ]),
    foot: [[
      "Total",
      formatINR(totalHouses),
      formatINR(totalOutside),
      formatINR(totalVendorPaidFromCommittee),
      formatINR(totalBalanceInHand),
    ]],
    footStyles: { fillColor: [245, 240, 242], textColor: INK_RGB, fontStyle: "bold", fontSize: 9.5 },
  });
  y = lastTableBottom(doc) + 8;

  // --- Vendor spend by category ---
  if (categoryTotals.size > 0) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 18;
    }
    y = sectionHeading(doc, "Vendor spend by category", marginX, y);
    autoTable(doc, {
      startY: y,
      theme: "grid",
      margin: { left: marginX, right: marginX },
      head: [["Category", "Billed", "Paid", "Outstanding"]],
      headStyles: { fillColor: BRAND_RGB, textColor: 255, fontSize: 9.5 },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      body: [...categoryTotals.entries()]
        .sort((a, b) => b[1].billed - a[1].billed)
        .map(([category, { billed, paid }]) => [
          category,
          formatINR(billed),
          formatINR(paid),
          formatINR(billed - paid),
        ]),
      foot: [[
        "Total",
        formatINR(totalBilled),
        formatINR(totalPaidAgainstBills),
        formatINR(totalBilled - totalPaidAgainstBills),
      ]],
      footStyles: { fillColor: [245, 240, 242], textColor: INK_RGB, fontStyle: "bold", fontSize: 10 },
    });
    y = lastTableBottom(doc) + 8;
  }

  // --- Outside collection by type ---
  if (outsideTotals.size > 0) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 18;
    }
    y = sectionHeading(doc, "Outside collection by type", marginX, y);
    autoTable(doc, {
      startY: y,
      theme: "grid",
      margin: { left: marginX, right: marginX },
      head: [["Type", "Amount"]],
      headStyles: { fillColor: BRAND_RGB, textColor: 255, fontSize: 9.5 },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 1: { halign: "right" } },
      body: [...outsideTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, amount]) => [type, formatINR(amount)]),
      foot: [["Total", formatINR(totalOutside)]],
      footStyles: { fillColor: [245, 240, 242], textColor: INK_RGB, fontStyle: "bold", fontSize: 10 },
    });
  }

  // Footer on every page, added last so pagination is already final.
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...FAINT_RGB);
    doc.text(
      "Generated from the GV Durga Puja app — see the Excel export for full line-item detail.",
      marginX,
      pageHeight - 8,
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
  }

  const filename = `GV Durga Puja ${activeYear.year} - Financial Summary.pdf`;
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
          text: `GV Durga Puja ${activeYear.year} financial summary`,
        });
        return;
      } catch (err) {
        // The user backing out of the share sheet shouldn't be treated as a
        // failure that falls back to an unwanted download — only a real
        // error should fall through.
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
