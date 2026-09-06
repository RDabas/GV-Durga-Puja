"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import { AmountInput, Field, FormError, SubmitButton, TextInput } from "@/components/FormControls";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";

type Mode = "switch" | "edit" | "new";

export function YearSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { years, activeYear, setActiveYear, startYear, updateYear } = usePujaData();
  const [mode, setMode] = useState<Mode>("switch");
  const edit = useAsyncAction();
  const create = useAsyncAction();

  const [shashthi, setShashthi] = useState(activeYear.shashthiDate);
  const [dashami, setDashami] = useState(activeYear.dashamiDate);

  const [newYear, setNewYear] = useState(activeYear.year + 1);
  const [newShashthi, setNewShashthi] = useState("");
  const [newDashami, setNewDashami] = useState("");

  function close() {
    setMode("switch");
    onClose();
  }

  function handleEdit(e: FormEvent) {
    e.preventDefault();
    edit.run(
      () =>
        updateYear(activeYear.id, {
          shashthiDate: shashthi,
          dashamiDate: dashami,
        }),
      close,
    );
  }

  function handleNew(e: FormEvent) {
    e.preventDefault();
    if (!newShashthi || !newDashami) return;
    create.run(
      () =>
        startYear({
          year: newYear,
          shashthiDate: newShashthi,
          dashamiDate: newDashami,
        }),
      close,
    );
  }

  const sorted = [...years].sort((a, b) => b.year - a.year);

  return (
    <Sheet
      open={open}
      onClose={close}
      title={mode === "new" ? "Start a new year" : mode === "edit" ? "Edit year" : "Puja year"}
      subtitle={mode === "switch" ? "Switch year, or start the next one" : undefined}
    >
      {mode === "switch" && (
        <div className="space-y-2">
          {sorted.map((year) => {
            const isActive = year.id === activeYear.id;
            return (
              <button
                key={year.id}
                type="button"
                onClick={() => {
                  setActiveYear(year.id);
                  close();
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left ${
                  isActive ? "border-brand bg-brand-tint" : "border-border bg-surface"
                }`}
              >
                <span>
                  <span
                    className={`block font-display text-[1rem] font-bold tabular-nums ${
                      isActive ? "text-brand" : "text-ink"
                    }`}
                  >
                    {year.year}
                  </span>
                </span>
                <span className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-faint">
                  {year.status === "active" ? "Current" : "History"}
                </span>
              </button>
            );
          })}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShashthi(activeYear.shashthiDate);
                setDashami(activeYear.dashamiDate);
                setMode("edit");
              }}
              className="rounded-xl border border-border py-2.5 text-[0.8rem] font-semibold text-ink-soft"
            >
              Edit {activeYear.year}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewYear(Math.max(...years.map((y) => y.year)) + 1);
                setMode("new");
              }}
              className="rounded-xl bg-brand py-2.5 text-[0.8rem] font-semibold text-white"
            >
              Start new year
            </button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <form onSubmit={handleEdit} className="space-y-4">
          <Field label="Shashthi">
            <TextInput
              type="date"
              value={shashthi}
              onChange={(e) => setShashthi(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Dashami">
            <TextInput
              type="date"
              value={dashami}
              onChange={(e) => setDashami(e.target.value)}
            />
          </Field>
          <FormError message={edit.error} />
          <SubmitButton disabled={edit.submitting} submitting={edit.submitting}>
            Save {activeYear.year}
          </SubmitButton>
        </form>
      )}

      {mode === "new" && (
        <form onSubmit={handleNew} className="space-y-4">
          <Field label="Year">
            <AmountInput value={newYear} onChange={setNewYear} />
          </Field>
          <Field label="Shashthi">
            <TextInput
              type="date"
              value={newShashthi}
              onChange={(e) => setNewShashthi(e.target.value)}
            />
          </Field>
          <Field label="Dashami">
            <TextInput
              type="date"
              value={newDashami}
              onChange={(e) => setNewDashami(e.target.value)}
            />
          </Field>
          <p className="text-[0.72rem] text-ink-faint">
            {activeYear.year} stays as history — nothing is deleted.
          </p>
          <FormError message={create.error} />
          <SubmitButton disabled={create.submitting} submitting={create.submitting}>
            Start {newYear}
          </SubmitButton>
        </form>
      )}
    </Sheet>
  );
}
