"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, SubmitButton, TextInput } from "@/components/FormControls";
import { createClient } from "@/lib/supabase/client";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { usePujaData } from "@/lib/store";

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) return;
    if (password !== confirm) return;
    run(async () => {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw new Error(error.message);
    }, onDone);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-border pt-4">
      <Field label="New password">
        <TextInput
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          autoFocus
        />
      </Field>
      <Field label="Confirm new password">
        <TextInput
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      {password.length > 0 && password.length < 6 && (
        <p className="text-[0.75rem] text-ink-faint">At least 6 characters.</p>
      )}
      {confirm.length > 0 && password !== confirm && (
        <p className="text-[0.75rem] text-critical">Passwords don&rsquo;t match.</p>
      )}
      <FormError message={error} />
      <SubmitButton
        disabled={submitting || password.length < 6 || password !== confirm}
        submitting={submitting}
      >
        Update password
      </SubmitButton>
    </form>
  );
}

/**
 * Rendered only while the sheet is open, so every open is a fresh mount —
 * changingPassword/justChanged/email/userId all start clean with no reset
 * effect needed, rather than persisting stale state from the last time this
 * was open (AccountSheet itself never unmounts).
 */
function AccountSheetBody() {
  const { members } = usePujaData();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setUserId(data.user?.id ?? null);
      });
  }, []);

  const me = members.find((m) => m.authUserId === userId);
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

      {!changingPassword ? (
        <button
          type="button"
          onClick={() => setChangingPassword(true)}
          className="w-full rounded-xl border border-border py-3 text-[0.9rem] font-semibold text-ink-soft"
        >
          Change password
        </button>
      ) : (
        <ChangePasswordForm
          onDone={() => {
            setChangingPassword(false);
            setJustChanged(true);
          }}
        />
      )}

      {justChanged && <p className="text-[0.78rem] text-success">Password updated.</p>}

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
