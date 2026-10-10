import type { ContributionStatus, PaymentMode } from "@/lib/types";

/**
 * Shared field options/labels for a contribution's status/mode and its
 * status-dependent wording — used by both ContributionSheet (owner/tenant,
 * which also has its own house-specific "paid via another flat" pseudo-status
 * layered on top) and ExResidentSheet (not tied to any flat).
 */

export const statusOptions: { value: ContributionStatus; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "bhog_only", label: "Bhog Only" },
  { value: "promised", label: "Promised" },
  { value: "pending", label: "Pending" },
  { value: "not_home", label: "Nobody home" },
  { value: "wont_pay", label: "Won't pay" },
  { value: "not_visited", label: "Not visited" },
];

export const modeOptions: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
];

export function followUpNoteLabel(status: ContributionStatus): string {
  switch (status) {
    case "promised":
      return "Follow-up note";
    case "pending":
      return "Note — what did they say?";
    case "wont_pay":
      return "Reason (optional)";
    default:
      return "Note for next visit";
  }
}

export function followUpNotePlaceholder(status: ContributionStatus): string {
  switch (status) {
    case "promised":
      return "e.g. said after the 12th";
    case "pending":
      return "e.g. checking with spouse, will confirm";
    case "wont_pay":
      return "e.g. moved out, declined";
    default:
      return "e.g. try again evening";
  }
}

/** Label for the main money-amount field — differs for "promised" once a bigger original pledge is on record. */
export function amountFieldLabel(status: ContributionStatus, originalPledgeAmount: number): string {
  if (status !== "promised") return "Amount received";
  return originalPledgeAmount > 0 ? "Amount remaining" : "Amount promised";
}

/** Shown under the money-amount field so "they only gave Bhog, no money" has an obvious path, rather than forcing an amount that doesn't apply. */
export const bhogOnlyHint =
  "If they're giving only Bhog / groceries, no money at all, use the \"Bhog Only\" status above instead.";

export function originalPledgeFieldLabel(status: ContributionStatus): string {
  return status === "promised"
    ? "Originally promised, if higher (optional)"
    : "Total amount promised, if more than what's paid (optional)";
}

export function originalPledgeHelpText(status: ContributionStatus): string {
  return status === "promised"
    ? "Fill this in only if part of the promise was already covered another way (e.g. they paid a vendor bill directly) — then “Amount remaining” above becomes what’s still pending. Leave at 0 for a plain promise."
    : "Fill this in if what's been paid is only part of a bigger promise — the card will then show what's still pending. Leave at 0 if there's no larger promise behind this payment.";
}
