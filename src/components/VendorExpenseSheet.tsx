"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import {
  AmountInput,
  Field,
  FormError,
  OptionGroup,
  SubmitButton,
  TextInput,
} from "@/components/FormControls";
import { ResidentPayerPicker, type ResidentPayerSelection } from "@/components/ResidentPayerPicker";
import { today } from "@/lib/format";
import { modeOptions } from "@/lib/contributionForm";
import type { ScannedPayment } from "@/lib/scanPayment";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import type { PaymentMode, VendorExpense } from "@/lib/types";

export function VendorExpenseSheet({
  open,
  expense,
  initialScan,
  onClose,
}: {
  open: boolean;
  /** Present to edit an existing bill (fixing a typo'd name or amount); absent to add a new one. */
  expense?: VendorExpense;
  /** Pre-fills this as paid-on-add, from a payment screenshot scanned before this sheet opened (see the "Scan payment" button on the Vendors page). */
  initialScan?: ScannedPayment;
  onClose: () => void;
}) {
  const { members, addVendorExpense, updateVendorExpense } = usePujaData();
  const [vendorName, setVendorName] = useState(expense?.vendor.name ?? "");
  const [serviceType, setServiceType] = useState(expense?.vendor.serviceType ?? "");
  const [totalAmount, setTotalAmount] = useState(expense?.totalAmount ?? initialScan?.amount ?? 0);

  // Some bills are settled the moment they're added (instant pay), others
  // run as installments over time — this lets the former skip the separate
  // "Record payment" step. Only offered when adding a new bill; an existing
  // bill already has its own payment history and Record-payment action.
  // Pre-checked when opened from a scan, since scanning one implies this
  // bill is being added specifically because it's already been paid.
  const [recordingPayment, setRecordingPayment] = useState(Boolean(initialScan));
  const [paidAmount, setPaidAmount] = useState(initialScan?.amount ?? 0);
  const [paidMode, setPaidMode] = useState<PaymentMode>(initialScan?.mode ?? "upi");
  const [paidById, setPaidById] = useState(members[0]?.id ?? "");
  const [paidDate, setPaidDate] = useState(initialScan?.paymentDate ?? today());
  const [selfFunded, setSelfFunded] = useState(false);
  const [paidByKind, setPaidByKind] = useState<"member" | "resident">("member");
  const [residentPayer, setResidentPayer] = useState<ResidentPayerSelection | null>(null);
  // A committee member can self-fund this out of their own pocket and still
  // have it settle a resident's (often their own) pledge directly.
  const [settledPledge, setSettledPledge] = useState<ResidentPayerSelection | null>(null);

  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vendorName.trim()) return;
    const input = {
      vendorName: vendorName.trim(),
      serviceType: serviceType.trim() || "Other",
      totalAmount,
    };
    run(
      async () => {
        if (expense) {
          await updateVendorExpense(expense.id, input);
          return;
        }
        const canRecordPayment =
          recordingPayment &&
          paidAmount > 0 &&
          (paidByKind === "resident" ? residentPayer : paidById);
        await addVendorExpense(
          input,
          canRecordPayment
            ? {
                amount: paidAmount,
                mode: paidMode,
                memberId: paidByKind === "resident" ? undefined : paidById,
                contributionId:
                  paidByKind === "resident"
                    ? residentPayer?.contributionId
                    : selfFunded
                      ? settledPledge?.contributionId
                      : undefined,
                paymentDate: paidDate,
                selfFunded: paidByKind === "member" ? selfFunded : undefined,
              }
            : undefined,
        );
      },
      () => {
        setVendorName("");
        setServiceType("");
        setTotalAmount(0);
        setRecordingPayment(false);
        setPaidAmount(0);
        onClose();
      },
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={expense ? "Edit vendor bill" : "Add vendor bill"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Vendor">
          <TextInput
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="e.g. Maa Tara Decorators"
            autoFocus
          />
        </Field>

        <Field label="Service">
          <TextInput
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="e.g. Pandal & lighting"
          />
        </Field>

        <Field label="Total amount">
          <AmountInput value={totalAmount} onChange={setTotalAmount} />
        </Field>

        {!expense && (
          <>
            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken p-3">
              <input
                type="checkbox"
                checked={recordingPayment}
                onChange={(e) => setRecordingPayment(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              />
              <span className="text-[0.8rem] text-ink-soft">
                Already paid — fully or as the first installment
              </span>
            </label>

            {recordingPayment && (
              <>
                {initialScan && (
                  <p className="text-[0.75rem] text-ink-faint">
                    Scanned — check the details below.
                  </p>
                )}

                <Field label="Amount paid">
                  <AmountInput value={paidAmount} onChange={setPaidAmount} />
                </Field>
                <Field label="Method">
                  <OptionGroup value={paidMode} onChange={setPaidMode} options={modeOptions} />
                </Field>
                <Field label="Paid by">
                  <OptionGroup
                    value={paidByKind}
                    onChange={setPaidByKind}
                    options={[
                      { value: "member", label: "A committee member" },
                      { value: "resident", label: "A resident directly" },
                    ]}
                  />
                </Field>
                {paidByKind === "resident" ? (
                  <Field label="Which resident">
                    <ResidentPayerPicker value={residentPayer} onChange={setResidentPayer} />
                  </Field>
                ) : (
                  <Field label="Committee member">
                    <OptionGroup
                      value={paidById}
                      onChange={setPaidById}
                      options={members.map((m) => ({ value: m.id, label: m.name }))}
                    />
                  </Field>
                )}
                <Field label="Date">
                  <TextInput
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                  />
                </Field>
                {paidByKind === "member" ? (
                  <>
                    <label className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken p-3">
                      <input
                        type="checkbox"
                        checked={selfFunded}
                        onChange={(e) => setSelfFunded(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                      />
                      <span className="text-[0.8rem] text-ink-soft">
                        Paid from their own pocket, not committee cash — won&rsquo;t count against
                        their balance in hand.
                      </span>
                    </label>
                    {selfFunded && (
                      <Field label="Settles a resident's pledge? (optional)">
                        <ResidentPayerPicker value={settledPledge} onChange={setSettledPledge} />
                      </Field>
                    )}
                  </>
                ) : (
                  <p className="text-[0.75rem] text-ink-faint">
                    Settles part of their pledge directly — won&rsquo;t count against any
                    committee member&rsquo;s balance in hand.
                  </p>
                )}
              </>
            )}
          </>
        )}

        <FormError message={error} />
        <SubmitButton disabled={submitting} submitting={submitting}>
          {expense ? "Save" : "Add bill"}
        </SubmitButton>
      </form>
    </Sheet>
  );
}
