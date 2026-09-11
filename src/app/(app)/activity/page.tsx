"use client";

import { useEffect, useState } from "react";
import { markActivitySeen } from "@/lib/activitySeen";
import { formatActivityTime, formatShortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { fetchActivityPage } from "@/lib/supabase/queries";
import { usePujaData } from "@/lib/store";
import type { ActivityEntry } from "@/lib/types";

const PAGE_SIZE = 30;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatShortDate(iso);
}

export default function ActivityPage() {
  const { latestActivityAt } = usePujaData();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    fetchActivityPage(supabase, undefined, PAGE_SIZE)
      .then((page) => {
        setEntries(page);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load activity."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    markActivitySeen(latestActivityAt);
  }, [latestActivityAt]);

  function loadMore() {
    const last = entries[entries.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const supabase = createClient();
    fetchActivityPage(supabase, last.createdAt, PAGE_SIZE)
      .then((page) => {
        setEntries((prev) => [...prev, ...page]);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load more."))
      .finally(() => setLoadingMore(false));
  }

  const groupedEntries = entries.reduce<
    { entry: ActivityEntry; day: string; showHeader: boolean }[]
  >((acc, entry) => {
    const day = dayLabel(entry.createdAt);
    const showHeader = acc.length === 0 || acc[acc.length - 1].day !== day;
    acc.push({ entry, day, showHeader });
    return acc;
  }, []);

  return (
    <div className="space-y-2.5">
      <p className="px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
        Activity
      </p>

      {loading && <p className="px-0.5 text-[0.8rem] text-ink-faint">Loading…</p>}
      {error && <p className="px-0.5 text-[0.8rem] text-critical">{error}</p>}

      {!loading && entries.length === 0 && !error && (
        <p className="rounded-2xl border border-border bg-surface p-3.5 text-[0.8rem] text-ink-faint">
          Nothing recorded yet.
        </p>
      )}

      {entries.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
          {groupedEntries.map(({ entry, day, showHeader }, i) => {
            return (
              <div key={entry.id}>
                {showHeader && (
                  <p
                    className={`px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-wide text-ink-faint ${
                      i > 0 ? "pt-3 border-t border-border" : "pt-3"
                    }`}
                  >
                    {day}
                  </p>
                )}
                <div className={`flex items-start gap-2.5 p-3 ${!showHeader ? "border-t border-border" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.85rem] text-ink">
                      <span className="font-semibold text-ink-soft">{entry.actorName}</span>{" "}
                      {entry.summary}
                    </p>
                    <p className="mt-0.5 text-[0.7rem] text-ink-faint">
                      {formatActivityTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && entries.length > 0 && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full rounded-xl border border-border py-2.5 text-[0.8rem] font-semibold text-ink-soft disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
