"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TrishulIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    setLoading(false);
    if (otpError) {
      setError("Couldn't send a code — check the email and try again.");
      return;
    }
    setCodeSent(true);
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setError("Incorrect or expired code — try again.");
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  function handleUseDifferentEmail() {
    setCodeSent(false);
    setCode("");
    setError(null);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground px-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-7 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-strong shadow-sm">
            <TrishulIcon className="h-6 w-6" />
          </span>
          <h1 className="mt-3 font-display text-xl font-extrabold text-ink">GV Durga Puja</h1>
          <p className="mt-1 text-[0.82rem] text-ink-faint">
            Committee sign-in for collections, sponsors &amp; vendors
          </p>
        </div>

        {!codeSent ? (
          <form onSubmit={handleSendCode} className="mt-6 space-y-3.5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[0.8rem] font-semibold text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-[0.9rem] text-ink outline-none focus-visible:border-brand"
                placeholder="you@example.com"
              />
            </div>

            {error && <p className="text-[0.8rem] text-critical">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-2.5 text-[0.9rem] font-semibold text-white transition disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="mt-6 space-y-3.5">
            <p className="text-[0.82rem] text-ink-faint">
              Enter the code sent to <span className="font-semibold text-ink">{email}</span>.
            </p>
            <div>
              <label htmlFor="code" className="mb-1.5 block text-[0.8rem] font-semibold text-ink">
                Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-center text-[1.1rem] tracking-[0.2em] text-ink outline-none focus-visible:border-brand"
                placeholder="00000000"
              />
            </div>

            {error && <p className="text-[0.8rem] text-critical">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-2.5 text-[0.9rem] font-semibold text-white transition disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>

            <button
              type="button"
              onClick={handleUseDifferentEmail}
              className="w-full text-center text-[0.8rem] font-semibold text-ink-faint"
            >
              Use a different email / resend code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
