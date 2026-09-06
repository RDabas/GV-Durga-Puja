"use client";

import { useState } from "react";
import { PaymentSheet } from "@/components/PaymentSheet";
import { SponsorCard } from "@/components/SponsorCard";
import { SponsorSheet } from "@/components/SponsorSheet";
import { PlusIcon } from "@/components/icons";
import { usePujaData } from "@/lib/store";

export default function SponsorsPage() {
  const { sponsors, addSponsorPayment, deleteSponsor } = usePujaData();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingFor, setPayingFor] = useState<string | null>(null);

  const editing = sponsors.find((s) => s.id === editingId);
  const paying = sponsors.find((s) => s.id === payingFor);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="px-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
          Sponsors
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-[0.75rem] font-semibold text-white active:scale-[0.98]"
        >
          <PlusIcon className="h-[13px] w-[13px]" />
          Add sponsor
        </button>
      </div>

      {sponsors.map((sponsor) => (
        <SponsorCard
          key={sponsor.id}
          sponsor={sponsor}
          onRecordPayment={() => setPayingFor(sponsor.id)}
          onEdit={() => setEditingId(sponsor.id)}
          onDelete={() => deleteSponsor(sponsor.id)}
        />
      ))}

      <SponsorSheet open={adding} onClose={() => setAdding(false)} />

      {editing && (
        <SponsorSheet
          key={editing.id}
          open
          sponsor={editing}
          onClose={() => setEditingId(null)}
        />
      )}

      {paying && (
        <PaymentSheet
          key={paying.id}
          open
          title="Record sponsor payment"
          subtitle={paying.name}
          memberLabel="Received by"
          onSubmit={(input) => addSponsorPayment(paying.id, input)}
          onClose={() => setPayingFor(null)}
        />
      )}
    </div>
  );
}
