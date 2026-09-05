"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { createClient } from "@/lib/supabase/client";
import { usePujaData } from "@/lib/store";

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { members } = usePujaData();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setUserId(data.user?.id ?? null);
      });
  }, [open]);

  const me = members.find((m) => m.authUserId === userId);
  const displayName = me?.name ?? email ?? "…";

  async function handleSignOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Account">
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
    </Sheet>
  );
}
