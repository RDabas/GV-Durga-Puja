"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { createClient } from "@/lib/supabase/client";
import { usePujaData } from "@/lib/store";

/**
 * Rendered only while the sheet is open, so every open is a fresh mount —
 * email starts clean with no reset effect needed, rather than persisting
 * stale state from the last time this was open (AccountSheet itself never
 * unmounts).
 */
function AccountSheetBody() {
  const { me } = usePujaData();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // me (from the store) doesn't carry an email — only fetched here, as a
  // fallback for display before a member is linked to their auth account.
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const displayName = me?.name ?? email ?? "…";

  async function handleSignOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.9rem] font-semibold text-ink">{displayName}</p>
        {email && me?.name && <p className="text-[0.75rem] text-ink-faint">{email}</p>}
        {me && <p className="mt-0.5 text-[0.72rem] capitalize text-ink-faint">{me.role}</p>}
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full rounded-xl border border-border py-3 text-[0.9rem] font-semibold text-critical disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Account">
      {open && <AccountSheetBody />}
    </Sheet>
  );
}
