const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  return inr.format(amount);
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Local (not UTC) yyyy-mm-dd, so a late-evening entry doesn't land on tomorrow. */
export function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

/** Relative-ish timestamp for the activity feed — recent entries read at a glance. */
export function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const now = new Date();
  if (mins < 24 * 60 && d.toDateString() === now.toDateString()) {
    return `${Math.floor(mins / 60)}h ago`;
  }
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${formatShortDate(iso)}, ${time}`;
}
