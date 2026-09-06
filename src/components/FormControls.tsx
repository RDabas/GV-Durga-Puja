"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-sunken px-3 py-2.5 text-[0.9rem] text-ink outline-none focus:border-brand";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function AmountInput({
  value,
  onChange,
  ...props
}: {
  value: number;
  onChange: (value: number) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      {...props}
      type="number"
      inputMode="numeric"
      min={0}
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={`${inputClass} tabular-nums`}
    />
  );
}

export function OptionGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-xl border px-3 py-2 text-[0.8rem] font-semibold ${
            option.value === value
              ? "border-brand bg-brand text-white"
              : "border-border bg-surface text-ink-soft"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SubmitButton({
  children,
  disabled,
  submitting,
}: {
  children: ReactNode;
  disabled?: boolean;
  /** Distinct from disabled — a form can be disabled for invalid input without a request in flight. */
  submitting?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[0.9rem] font-semibold text-white active:scale-[0.99] disabled:opacity-60"
    >
      {submitting && (
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {submitting ? "Saving…" : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-[0.8rem] text-critical">{message}</p>;
}
