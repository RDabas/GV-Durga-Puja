import ExcelJS from "exceljs";
import type { PujaStore } from "@/lib/store";
import { paymentModeLabels } from "@/lib/payment";
import { carriedFundKindLabels } from "@/lib/carriedFund";
import { committeeBalances } from "@/lib/balances";
import type { ContributionStatus, SponsorType } from "@/lib/types";

const statusLabels: Record<ContributionStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  promised: "Promised",
  pending: "Pending",
  not_visited: "Not visited",
  not_home: "Nobody home",
};

const sponsorTypeLabels: Record<SponsorType, string> = {
  outside: "Outside",
  stall: "Stall",
  no_stall: "No stall",
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * One workbook covering everything in the active year: per-flat collection
 * status (mirroring the owner/tenant split shown on the Collect tab, since an
 * owner pays once for every flat they hold rather than per flat), sponsors,
 * vendor bills, who's holding how much, and the raw fund movements behind
 * that balance. Built and downloaded entirely client-side — nothing is sent
 * to a server for this.
 */
export async function exportPujaDataToExcel(store: PujaStore): Promise<void> {
  const {
    activeYear,
    houses,
    contributions,
    sponsors,
    vendorExpenses,
    members,
    carriedFunds,
    fundTransfers,
    contributionFor,
    ownerOf,
    memberName,
  } = store;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GV Durga Puja";
  workbook.created = new Date();

  const flatsSheet = workbook.addWorksheet("Flats");
  flatsSheet.columns = [
    { header: "Block", key: "block", width: 8 },
    { header: "Floor", key: "floor", width: 8 },
    { header: "Flat No", key: "flatNo", width: 10 },
    { header: "Owner Name(s)", key: "ownerNames", width: 28 },
    { header: "Owner Phone", key: "ownerPhone", width: 14 },
    { header: "Owner Status", key: "ownerStatus", width: 14 },
    { header: "Owner Amount", key: "ownerAmount", width: 14 },
    { header: "Owner Mode", key: "ownerMode", width: 12 },
    { header: "Owner Collected By", key: "ownerCollector", width: 16 },
    { header: "Tenant Name(s)", key: "tenantNames", width: 28 },
    { header: "Tenant Phone", key: "tenantPhone", width: 14 },
    { header: "Tenant Status", key: "tenantStatus", width: 14 },
    { header: "Tenant Amount", key: "tenantAmount", width: 14 },
    { header: "Bhog/Grocery", key: "bhog", width: 14 },
    { header: "Tenant Mode", key: "tenantMode", width: 12 },
    { header: "Tenant Collected By", key: "tenantCollector", width: 16 },
    { header: "Follow-up Note", key: "note", width: 30 },
  ];
  for (const house of houses) {
    const owner = ownerOf(house);
    const ownerContribution = owner ? contributionFor({ ownerId: owner.id }) : undefined;
    const tenantContribution = contributionFor({ houseId: house.id });
    flatsSheet.addRow({
      block: house.block,
      floor: house.floor,
      flatNo: house.flatNo,
      ownerNames: owner?.names.join(", ") ?? "",
      ownerPhone: owner?.phone ?? "",
      ownerStatus: ownerContribution ? statusLabels[ownerContribution.status] : "",
      ownerAmount: ownerContribution ? ownerContribution.moneyAmount : "",
      ownerMode:
        ownerContribution && ownerContribution.moneyAmount > 0
          ? paymentModeLabels[ownerContribution.paymentMode]
          : "",
      ownerCollector: memberName(ownerContribution?.collectorId) ?? "",
      tenantNames: house.tenantNames.join(", "),
      tenantPhone: house.tenantPhone ?? "",
      tenantStatus: tenantContribution ? statusLabels[tenantContribution.status] : "",
      tenantAmount: tenantContribution ? tenantContribution.moneyAmount : "",
      bhog: tenantContribution ? tenantContribution.bhogGroceryAmount : "",
      tenantMode:
        tenantContribution && tenantContribution.moneyAmount > 0
          ? paymentModeLabels[tenantContribution.paymentMode]
          : "",
      tenantCollector: memberName(tenantContribution?.collectorId) ?? "",
      note: tenantContribution?.followUpNote ?? ownerContribution?.followUpNote ?? "",
    });
  }
  styleHeader(flatsSheet);

  const sponsorsSheet = workbook.addWorksheet("Sponsors");
  sponsorsSheet.columns = [
    { header: "Name", key: "name", width: 26 },
    { header: "Type", key: "type", width: 12 },
    { header: "Stall Details", key: "stall", width: 20 },
    { header: "Contact", key: "contact", width: 16 },
    { header: "Pledged", key: "pledged", width: 14 },
    { header: "Received", key: "received", width: 14 },
    { header: "Balance", key: "balance", width: 14 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  for (const s of sponsors) {
    const received = s.payments.reduce((sum, p) => sum + p.amount, 0);
    sponsorsSheet.addRow({
      name: s.name,
      type: sponsorTypeLabels[s.type],
      stall: s.stallDetails ?? "",
      contact: s.contact ?? "",
      pledged: s.amountPledged,
      received,
      balance: s.amountPledged - received,
      notes: s.notes ?? "",
    });
  }
  styleHeader(sponsorsSheet);

  const sponsorPaymentsSheet = workbook.addWorksheet("Sponsor Payments");
  sponsorPaymentsSheet.columns = [
    { header: "Sponsor", key: "sponsor", width: 26 },
    { header: "Date", key: "date", width: 14 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Received By", key: "receivedBy", width: 16 },
    { header: "Note", key: "note", width: 30 },
  ];
  for (const s of sponsors) {
    for (const p of s.payments) {
      sponsorPaymentsSheet.addRow({
        sponsor: s.name,
        date: p.paymentDate,
        amount: p.amount,
        mode: paymentModeLabels[p.mode],
        receivedBy: memberName(p.memberId) ?? "",
        note: p.note ?? "",
      });
    }
  }
  styleHeader(sponsorPaymentsSheet);

  const vendorsSheet = workbook.addWorksheet("Vendor Bills");
  vendorsSheet.columns = [
    { header: "Vendor", key: "vendor", width: 26 },
    { header: "Service", key: "service", width: 20 },
    { header: "Phone", key: "phone", width: 14 },
    { header: "Total", key: "total", width: 14 },
    { header: "Paid", key: "paid", width: 14 },
    { header: "Balance", key: "balance", width: 14 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  for (const e of vendorExpenses) {
    const paid = e.payments.reduce((sum, p) => sum + p.amount, 0);
    vendorsSheet.addRow({
      vendor: e.vendor.name,
      service: e.vendor.serviceType,
      phone: e.vendor.phone ?? "",
      total: e.totalAmount,
      paid,
      balance: e.totalAmount - paid,
      notes: e.notes ?? "",
    });
  }
  styleHeader(vendorsSheet);

  const vendorPaymentsSheet = workbook.addWorksheet("Vendor Payments");
  vendorPaymentsSheet.columns = [
    { header: "Vendor", key: "vendor", width: 26 },
    { header: "Date", key: "date", width: 14 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Paid By", key: "paidBy", width: 16 },
    { header: "Self-funded", key: "selfFunded", width: 12 },
    { header: "Note", key: "note", width: 30 },
  ];
  for (const e of vendorExpenses) {
    for (const p of e.payments) {
      vendorPaymentsSheet.addRow({
        vendor: e.vendor.name,
        date: p.paymentDate,
        amount: p.amount,
        mode: paymentModeLabels[p.mode],
        paidBy: memberName(p.memberId) ?? "",
        selfFunded: p.selfFunded ? "Yes" : "",
        note: p.note ?? "",
      });
    }
  }
  styleHeader(vendorPaymentsSheet);

  const balances = committeeBalances(
    members,
    contributions,
    fundTransfers,
    sponsors,
    vendorExpenses,
    carriedFunds,
  );
  const balancesSheet = workbook.addWorksheet("Money Holders");
  balancesSheet.columns = [
    { header: "Member", key: "member", width: 20 },
    { header: "Role", key: "role", width: 12 },
    { header: "Collected (Houses)", key: "collected", width: 18 },
    { header: "Sponsor Payments Received", key: "sponsorReceived", width: 24 },
    { header: "Carried In", key: "carried", width: 14 },
    { header: "Received From Others", key: "received", width: 18 },
    { header: "Handed Over", key: "handedOver", width: 14 },
    { header: "Paid To Vendors", key: "vendorPaid", width: 16 },
    { header: "Balance In Hand", key: "balance", width: 16 },
  ];
  for (const b of balances) {
    balancesSheet.addRow({
      member: b.member.name,
      role: b.member.role === "admin" ? "Admin" : "Collector",
      collected: b.collected,
      sponsorReceived: b.sponsorReceived,
      carried: b.carriedCash + b.carriedFd + b.carriedBank,
      received: b.received,
      handedOver: b.handedOver,
      vendorPaid: b.vendorPaid,
      balance: b.balanceInHand,
    });
  }
  styleHeader(balancesSheet);

  const transfersSheet = workbook.addWorksheet("Fund Transfers");
  transfersSheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "From", key: "from", width: 18 },
    { header: "To", key: "to", width: 18 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Note", key: "note", width: 30 },
  ];
  for (const t of fundTransfers) {
    transfersSheet.addRow({
      date: t.transferDate,
      from: memberName(t.fromMemberId) ?? "(outside committee)",
      to: memberName(t.toMemberId) ?? "(outside committee)",
      amount: t.amount,
      mode: t.mode === "cash" ? "Cash" : "Online",
      note: t.note ?? "",
    });
  }
  styleHeader(transfersSheet);

  const carriedSheet = workbook.addWorksheet("Carried Over Funds");
  carriedSheet.columns = [
    { header: "Member", key: "member", width: 20 },
    { header: "Kind", key: "kind", width: 16 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Note", key: "note", width: 30 },
  ];
  for (const f of carriedFunds) {
    carriedSheet.addRow({
      member: memberName(f.memberId) ?? "",
      kind: carriedFundKindLabels[f.kind],
      amount: f.amount,
      note: f.note ?? "",
    });
  }
  styleHeader(carriedSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `GV Durga Puja ${activeYear.year}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
