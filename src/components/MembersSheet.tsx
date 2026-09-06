"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import { Field, FormError, OptionGroup, SubmitButton, TextInput } from "@/components/FormControls";
import { usePujaData } from "@/lib/store";
import { useAsyncAction } from "@/lib/useAsyncAction";
import type { CommitteeMember } from "@/lib/types";

const roleOptions: { value: CommitteeMember["role"]; label: string }[] = [
  { value: "collector", label: "Collector" },
  { value: "admin", label: "Admin" },
];

function EditMemberRow({
  member,
  onDone,
}: {
  member: CommitteeMember;
  onDone: () => void;
}) {
  const { updateMember } = usePujaData();
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [role, setRole] = useState(member.role);
  const { submitting, error, run } = useAsyncAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    run(
      () => updateMember(member.id, { name: name.trim(), phone: phone.trim() || undefined, role }),
      onDone,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-brand p-3">
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Role">
        <OptionGroup value={role} onChange={setRole} options={roleOptions} />
      </Field>
      <Field label="Phone">
        <TextInput
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Optional"
        />
      </Field>
      <FormError message={error} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl border border-border py-2 text-[0.8rem] font-semibold text-ink-soft"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-[0.8rem] font-semibold text-white disabled:opacity-60"
        >
          {submitting && (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function MembersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { members, addMember, removeMember, isMemberRemovable } = usePujaData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<CommitteeMember["role"]>("collector");
  const { submitting, error, run } = useAsyncAction();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    run(() => addMember({ name: name.trim(), phone: phone.trim() || undefined, role }), () => {
      setName("");
      setPhone("");
      setRole("collector");
    });
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    setRemoveError(null);
    try {
      await removeMember(memberId);
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Couldn't remove that member.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Who collects"
      subtitle="These names appear as “Collected by” when recording money"
    >
      <div className="space-y-2">
        {members.map((member) => {
          if (editingId === member.id) {
            return (
              <EditMemberRow key={member.id} member={member} onDone={() => setEditingId(null)} />
            );
          }

          const removable = isMemberRemovable(member.id);
          return (
            <div key={member.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ground-alt font-display text-[0.78rem] font-bold text-ink-soft">
                  {member.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.86rem] font-semibold text-ink">
                    {member.name}
                    {!member.authUserId && (
                      <span className="ml-1.5 font-normal text-ink-faint">· no login yet</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[0.7rem] capitalize text-ink-faint">
                    {member.role}
                    {member.phone && ` · ${member.phone}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(member.id)}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink-soft"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(member.id)}
                  disabled={!removable || removingId === member.id}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink-soft disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
              {!removable && (
                <p className="mt-2 text-[0.68rem] text-ink-faint">
                  Can&rsquo;t remove — {member.name} already has money recorded against them
                  (a collection, sponsor payment, vendor payment, or transfer). Rename them
                  instead, or move on without removing.
                </p>
              )}
            </div>
          );
        })}
        <FormError message={removeError} />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-border pt-5">
        <Field label="Add someone">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
          />
        </Field>
        <Field label="Role">
          <OptionGroup value={role} onChange={setRole} options={roleOptions} />
        </Field>
        <Field label="Phone">
          <TextInput
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <FormError message={error} />
        <SubmitButton disabled={submitting} submitting={submitting}>Add member</SubmitButton>
      </form>
    </Sheet>
  );
}
