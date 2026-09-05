"use client";

import { useCallback, useState } from "react";

/**
 * Every form in the app now writes to Supabase instead of localStorage, so
 * every submit can fail (network, or an RLS policy rejecting a collector's
 * edit to someone else's entry). This is the one place that turns "await a
 * mutator" into a submitting flag plus a readable error, so each Sheet
 * doesn't reimplement the same try/catch/finally.
 */
export function useAsyncAction() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>, onSuccess?: () => void) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submitting, error, run };
}
