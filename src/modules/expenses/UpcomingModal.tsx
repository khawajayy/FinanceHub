import { CalendarClock, X } from "lucide-react";
import { useState } from "react";
import { AmountInput, Field, Modal, Segmented } from "@/components/ui";
import { type UpcomingExpense, type UpcomingPriority } from "@/engine/expense-engine";
import { fmtAmtStr, stripNum } from "@/lib/format";
import { useExpenses } from "@/stores/expenses";
import { toast } from "@/stores/ui";

const PRI_OPTIONS = [
  { value: "low", label: "Low · Wishlist" },
  { value: "med", label: "Medium · Planned" },
  { value: "high", label: "High · Essential" },
];

export function UpcomingModal({
  open,
  upcoming,
  initialBucketId,
  onClose,
}: {
  open: boolean;
  upcoming: UpcomingExpense | null;
  initialBucketId?: string | null;
  onClose: () => void;
}) {
  const categories = useExpenses((s) => s.categories);
  const buckets = useExpenses((s) => s.buckets).filter((b) => b.status === "active");
  const add = useExpenses((s) => s.addUpcoming);
  const update = useExpenses((s) => s.updateUpcoming);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState<string>("");
  const [bucket, setBucket] = useState<string>("");
  const [priority, setPriority] = useState<UpcomingPriority>("med");
  const [notes, setNotes] = useState("");
  const [seenOpen, setSeenOpen] = useState(false);

  // Sync form when opening
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setTitle(upcoming?.title || "");
      setAmount(upcoming?.amount ? fmtAmtStr(upcoming.amount) : "");
      setCategory(upcoming?.category || categories[0]?.key || null);
      setDate(upcoming?.date || "");
      setBucket(upcoming?.bucket || initialBucketId || "");
      setPriority(upcoming?.priority || "med");
      setNotes(upcoming?.notes || "");
    }
  }

  const save = async () => {
    if (!title.trim()) { toast("Give the planned expense a title", true); return; }
    const num = stripNum(amount);
    if (!num || num <= 0) { toast("Enter an estimated amount", true); return; }

    const input = {
      title: title.trim(),
      amount: num,
      category: category || null,
      date: date || null,
      bucket: bucket || null,
      priority,
      notes: notes.trim(),
    };

    if (upcoming) {
      await update(upcoming.id, input);
      toast(`Updated "${title.trim()}"`);
    } else {
      await add(input);
      toast(`Added planned expense "${title.trim()}"`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={upcoming ? "Edit planned expense" : "Plan future expense"}
      icon={<CalendarClock size={16} />}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>
            {upcoming ? "Save changes" : "Add to planned"}
          </button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="What are you thinking of spending on?">
          <input
            autoFocus
            className="input font-medium"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Car Insurance, Vacation Flights, New Laptop"
            maxLength={200}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Estimated amount">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">Rs</span>
              <AmountInput
                className="!pl-11 font-semibold"
                value={amount}
                onChange={setAmount}
                placeholder="0"
              />
            </div>
          </Field>

          <Field label="Category">
            <select
              className="input !py-2.5 text-sm"
              value={category || ""}
              onChange={(e) => setCategory(e.target.value || null)}
              aria-label="Category"
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.emoji} {c.key}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Bucket (optional)" hint="Group with a trip, event, or project">
            <select
              className="input !py-2.5 text-sm"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              aria-label="Bucket"
            >
              <option value="">None (General / To Think About)</option>
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.emoji} {b.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Target date (optional)" hint="When do you expect to spend this?">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="date"
                  className="input !py-2 text-sm"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="Target date"
                />
              </div>
              {date && (
                <button
                  type="button"
                  className="chip !normal-case hover:!text-ink"
                  onClick={() => setDate("")}
                  title="Clear target date"
                >
                  <X size={12} /> Flexible
                </button>
              )}
            </div>
          </Field>
        </div>

        <Field label="Priority / Commitment">
          <Segmented
            id="upcoming-pri"
            size="sm"
            value={priority}
            onChange={(v) => setPriority(v as UpcomingPriority)}
            options={PRI_OPTIONS}
          />
        </Field>

        <Field label="Notes & Considerations (optional)">
          <textarea
            className="input min-h-[70px] resize-y !py-2 text-sm"
            placeholder="Options being considered, vendor quotes, links, prerequisites..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            aria-label="Notes"
          />
        </Field>

        <div className="rounded-xl border border-line/10 bg-line/[.03] p-3 text-[11.5px] text-muted">
          💡 <b>Not counted in expenses yet:</b> This stays in your planning board and won't affect monthly spending or bank balances until you click &ldquo;Log as Expense&rdquo;.
        </div>

        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
