import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArchiveRestore, CalendarClock, ChevronDown, Pencil, Plus, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AmountInput, Card, Empty, Field, Modal } from "@/components/ui";
import { BUCKET_COLORS, bucketSummary, categoryColor, categoryEmoji, targetDateLabel, todayISO, upcomingSummary, type Bucket, type UpcomingExpense } from "@/engine/expense-engine";
import { cx, fmtAmtStr, fmtRs, stripNum } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useExpenses } from "@/stores/expenses";
import { confirmDialog, toast } from "@/stores/ui";
import { LoadingGrid, PageTitle } from "./common";
import { UpcomingModal } from "./UpcomingModal";

const EMOJIS = ["🕋", "✈️", "💍", "🏠", "🎓", "🚗", "🎉", "🏥", "👶", "🧺"];
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });

export function BucketModal({ open, bucket, onClose }: { open: boolean; bucket: Bucket | null; onClose: () => void }) {
  const add = useExpenses((s) => s.addBucket);
  const update = useExpenses((s) => s.updateBucket);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(BUCKET_COLORS[0]);
  const [budget, setBudget] = useState("");
  const [inExpenses, setInExpenses] = useState(true);
  const [seenOpen, setSeenOpen] = useState(false);

  // Reset the form each time the modal opens.
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setName(bucket?.name || ""); setEmoji(bucket?.emoji || EMOJIS[0]);
      setColor(bucket?.color || BUCKET_COLORS[0]); setBudget(bucket?.budget ? fmtAmtStr(bucket.budget) : "");
      setInExpenses(bucket?.in_expenses !== false);
    }
  }

  const save = async () => {
    if (!name.trim()) { toast("Give the bucket a name.", true); return; }
    const b = stripNum(budget);
    const input = { name, emoji, color, budget: b > 0 ? b : null, in_expenses: inExpenses };
    if (bucket) { await update(bucket.id, input); toast("Bucket updated"); }
    else { await add(input); toast(`Bucket "${name.trim()}" created`); }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={bucket ? "Edit bucket" : "New bucket"} icon={<ShoppingBag size={16} />}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{bucket ? "Save changes" : "Create bucket"}</button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid grid-cols-[72px_1fr] gap-3">
          <Field label="Icon"><input className="input text-center !text-xl" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} aria-label="Bucket emoji" /></Field>
          <Field label="Name"><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Umrah 2026, Wedding, House move" maxLength={60} /></Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button type="button" key={e} onClick={() => setEmoji(e)} className={cx("grid h-9 w-9 place-items-center rounded-xl text-lg ring-1 transition", emoji === e ? "bg-line/10 ring-line/30" : "ring-line/10 hover:bg-line/5")}>{e}</button>
          ))}
        </div>
        <div>
          <span className="field-label">Colour</span>
          <div className="flex flex-wrap gap-2">
            {BUCKET_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`}
                className={cx("h-7 w-7 rounded-full transition", color === c ? "scale-110 ring-2 ring-ink/70 ring-offset-2 ring-offset-bg" : "opacity-70 hover:opacity-100")} style={{ background: c }} />
            ))}
          </div>
        </div>
        <Field label="Budget (optional)" hint="Set one to see how much is left as you spend.">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">Rs</span>
            <AmountInput className="!pl-11" value={budget} onChange={setBudget} placeholder="No budget" />
          </div>
        </Field>
        <IncludeToggle on={inExpenses} set={setInExpenses} />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** On: the bucket's transactions count in monthly spending. Off: a separate ledger, only totalled here. */
function IncludeToggle({ on, set, compact }: { on: boolean; set: (v: boolean) => void; compact?: boolean }) {
  return (
    <div className={cx("flex items-center gap-3 rounded-2xl ring-1 transition-colors", compact ? "p-2.5" : "p-3", on ? "bg-cyan/10 ring-cyan/30" : "bg-line/[.03] ring-line/5")}>
      <button type="button" role="switch" aria-checked={on} aria-label="Include in expenses" onClick={() => set(!on)}
        className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-cyan" : "bg-line/20")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
      <div className="min-w-0 text-sm">
        <div className="font-semibold">Include in expenses</div>
        <div className="text-[11.5px] text-muted">{on ? "Counts in your monthly spending, charts and savings rate." : "Separate ledger: totalled here only, left out of monthly spending."}</div>
      </div>
    </div>
  );
}

/** Spent vs budget bar; without a budget it's a plain full bar in the bucket colour. */
export function BucketBar({ spent, budget, color }: { spent: number; budget: number | null; color: string }) {
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 100;
  const over = budget != null && spent > budget;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line/[.07]">
      <motion.div className="h-full rounded-full" style={{ background: over ? "rgb(var(--neg))" : color, boxShadow: `0 0 10px ${over ? "rgb(var(--neg))" : color}` }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

function BucketCard({ b, delay, onEdit, onPlan }: { b: Bucket; delay: number; onEdit: () => void; onPlan: (bucketId: string) => void }) {
  const txns = useExpenses((s) => s.txns);
  const upcoming = useExpenses((s) => s.upcoming);
  const categories = useExpenses((s) => s.categories);
  const update = useExpenses((s) => s.updateBucket);
  const del = useExpenses((s) => s.deleteBucket);
  const convert = useExpenses((s) => s.convertUpcomingToExpense);
  const undoConvert = useExpenses((s) => s.undoConvertUpcoming);
  const openExpense = useActions((s) => s.openExpense);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"txns" | "planned">("txns");
  const s = bucketSummary(txns, b.id);
  const up = upcomingSummary(upcoming, b.id);
  const closed = b.status === "closed";
  const left = b.budget != null ? b.budget - s.net : null;
  const items = [...s.items].sort((x, y) => y.txn_date.localeCompare(x.txn_date) || y.created_at - x.created_at);

  const separate = b.in_expenses === false;
  const setInExpenses = (on: boolean) => {
    update(b.id, { in_expenses: on });
    toast(on ? `"${b.name}" now counts in your expenses` : `"${b.name}" is now a separate ledger`);
  };

  const remove = async () => {
    const msg = s.count
      ? `Delete "${b.name}"? Its ${s.count} transaction${s.count === 1 ? "" : "s"} stay in your spending history, they just won't be tagged with this bucket any more.`
        + (separate ? " Because they won't be in a separate bucket any more, they'll start counting in your monthly spending." : "")
      : `Delete "${b.name}"?`;
    if (!(await confirmDialog("Delete bucket", msg, { confirmText: "Delete bucket", danger: true }))) return;
    await del(b.id);
    toast(`Bucket "${b.name}" deleted`);
  };

  const handleConvertUpcoming = async (item: UpcomingExpense) => {
    const txnId = await convert(item.id);
    toast(`Logged "${item.title}" (${fmtRs(item.amount)}) to expenses`, false, {
      label: "Undo",
      onClick: () => undoConvert(item.id, txnId),
    });
  };

  return (
    <Card delay={delay} className={cx(closed && "opacity-75")}>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ background: `${b.color}22`, boxShadow: `inset 0 0 0 1px ${b.color}44` }}>{b.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-lg font-semibold">{b.name}</h3>
              {closed && <span className="chip !py-0.5 !text-[10px]">Closed</span>}
              {separate && <span className="chip !py-0.5 !text-[10px]" title="Kept out of monthly spending totals">Separate</span>}
            </div>
            <div className="text-xs text-muted">
              {s.count ? <>{s.count} transaction{s.count === 1 ? "" : "s"} · {s.first === s.last ? shortDate(s.first!) : `${shortDate(s.first!)} – ${shortDate(s.last!)}`}</> : "No transactions yet"}
              {up.count > 0 && <span className="text-amber ml-2">· {up.count} planned</span>}
            </div>
          </div>
          <div className="flex shrink-0">
            <button className="icon-btn" title="Edit" onClick={onEdit}><Pencil size={15} /></button>
            <button className="icon-btn" title={closed ? "Reopen" : "Close (hide from the transaction form)"} onClick={() => { update(b.id, { status: closed ? "active" : "closed" }); toast(closed ? "Bucket reopened" : "Bucket closed"); }}>
              {closed ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </button>
            <button className="icon-btn hover:!text-neg" title="Delete bucket" onClick={remove}><Trash2 size={15} /></button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <div className="label !text-[10px]">Spent</div>
            <div className="num text-2xl font-semibold">{fmtRs(s.net)}</div>
          </div>
          {up.count > 0 && (
            <div className="border-l border-line/10 pl-3">
              <div className="label !text-[10px] text-amber">Planned ({up.count})</div>
              <div className="num text-lg font-semibold text-amber">{fmtRs(up.total)}</div>
            </div>
          )}
          {b.budget != null && (
            <div className="ml-auto text-right text-xs">
              <div className="text-muted">of {fmtRs(b.budget)}</div>
              <div className={cx("num font-semibold", left! < 0 ? "neg" : "pos")}>{left! < 0 ? `${fmtRs(-left!)} over` : `${fmtRs(left!)} left`}</div>
            </div>
          )}
        </div>
        <div className="mt-2"><BucketBar spent={s.net} budget={b.budget} color={b.color} /></div>
        {s.received > 0 && <div className="mt-2 text-xs text-muted">Includes <span className="num pos">{fmtRs(s.received)}</span> received back (refunds etc.)</div>}
        <div className="mt-4"><IncludeToggle compact on={!separate} set={setInExpenses} /></div>

        {s.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {s.categories.map((c) => (
              <span key={c.category} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px]" style={{ background: `${categoryColor(c.category, categories)}18` }}>
                {categoryEmoji(c.category, categories)} <span className="text-muted">{c.category.split(" (")[0]}</span> <span className="num font-semibold">{fmtRs(c.amount)}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!closed && (
            <>
              <button className="btn btn-sm" onClick={() => openExpense(null, b.id)}>
                <Plus size={13} /> Add expense
              </button>
              <button className="btn btn-sm btn-ghost inline-flex items-center gap-1" onClick={() => onPlan(b.id)}>
                <CalendarClock size={13} /> Plan future
              </button>
            </>
          )}
          {(s.count > 0 || up.count > 0) && (
            <button className="btn btn-sm btn-ghost ml-auto inline-flex items-center gap-1" onClick={() => setOpen(!open)}>
              {open ? "Hide" : "Show"} details <ChevronDown size={13} className={cx("transition", open && "rotate-180")} />
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t hairline">
            {(s.count > 0 && up.count > 0) && (
              <div className="flex border-b border-line/10 bg-line/[.02] px-4 pt-2">
                <button
                  type="button"
                  onClick={() => setTab("txns")}
                  className={cx("border-b-2 px-3 pb-2 text-xs font-semibold transition", tab === "txns" ? "border-cyan text-ink" : "border-transparent text-muted hover:text-ink")}
                >
                  Transactions ({s.count})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("planned")}
                  className={cx("border-b-2 px-3 pb-2 text-xs font-semibold transition", tab === "planned" ? "border-amber text-amber" : "border-transparent text-muted hover:text-ink")}
                >
                  Planned ({up.count})
                </button>
              </div>
            )}

            {tab === "planned" || (s.count === 0 && up.count > 0) ? (
              <div className="divide-y divide-line/5">
                {up.items.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <div>
                      <div className="font-medium text-ink">{u.title}</div>
                      <div className="text-[11px] text-muted">
                        {u.date ? `Target: ${targetDateLabel(u.date, todayISO())}` : "Flexible date"}
                        {u.notes && ` · ${u.notes}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="num font-semibold text-ink">{fmtRs(u.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handleConvertUpcoming(u)}
                        className="btn btn-primary btn-sm !py-1 !px-2.5 !text-[11px] inline-flex items-center gap-1"
                        title="Log this expense now"
                      >
                        <Wallet size={11} /> Log
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-line/5">
                {items.map((t) => (
                  <button key={t.id} onClick={() => openExpense(t)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-line/[.03]">
                    <span className="text-base">{t.direction === "IN" ? "💰" : categoryEmoji(t.category, categories)}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm">{t.description}</div><div className="text-[11px] text-muted">{shortDate(t.txn_date)}</div></div>
                    <span className={cx("num text-sm font-semibold", t.direction === "IN" ? "pos" : "neg")}>{t.direction === "IN" ? "+" : "−"} {fmtRs(t.amount)}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function Buckets() {
  const loaded = useExpenses((s) => s.loaded);
  const buckets = useExpenses((s) => s.buckets);
  const [modal, setModal] = useState<{ open: boolean; bucket: Bucket | null }>({ open: false, bucket: null });
  const [planModal, setPlanModal] = useState<{ open: boolean; bucketId?: string }>({ open: false });
  const active = buckets.filter((b) => b.status === "active");
  const closed = buckets.filter((b) => b.status === "closed");

  return (
    <>
      <PageTitle title="Buckets" sub="Group spending for a trip or event. Delete a bucket when you're done; its transactions stay."
        right={
          <div className="flex items-center gap-2">
            <Link to="/expenses/upcoming" className="btn btn-ghost inline-flex items-center gap-1.5 text-xs">
              <CalendarClock size={14} /> Upcoming Expenses
            </Link>
            <button className="btn btn-primary" onClick={() => setModal({ open: true, bucket: null })}>
              <Plus size={15} /> New bucket
            </button>
          </div>
        }
      />
      {!loaded ? <LoadingGrid /> : buckets.length === 0 ? (
        <Card>
          <Empty icon="🧺" title="No buckets yet" sub="Make one for something like Umrah or a wedding, then tag expenses with it as you go. Totals run across months."
            action={<button className="btn btn-primary" onClick={() => setModal({ open: true, bucket: null })}><Plus size={15} /> New bucket</button>} />
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {active.map((b, i) => (
                <BucketCard
                  key={b.id}
                  b={b}
                  delay={i * 0.05}
                  onEdit={() => setModal({ open: true, bucket: b })}
                  onPlan={(bucketId) => setPlanModal({ open: true, bucketId })}
                />
              ))}
            </div>
          )}
          {closed.length > 0 && (
            <div>
              <div className="label mb-3">Closed</div>
              <div className="grid gap-4 lg:grid-cols-2">
                {closed.map((b, i) => (
                  <BucketCard
                    key={b.id}
                    b={b}
                    delay={i * 0.05}
                    onEdit={() => setModal({ open: true, bucket: b })}
                    onPlan={(bucketId) => setPlanModal({ open: true, bucketId })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line/10 bg-line/[.02] p-4 text-xs text-muted">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="text-cyan" />
          <span>Planning future purchases or expenses to think about? Manage them in Upcoming Expenses.</span>
        </div>
        <Link to="/expenses/upcoming" className="font-semibold text-cyan hover:underline shrink-0 ml-4">
          Open Upcoming Expenses →
        </Link>
      </div>

      <BucketModal open={modal.open} bucket={modal.bucket} onClose={() => setModal((m) => ({ ...m, open: false }))} />
      <UpcomingModal
        open={planModal.open}
        upcoming={null}
        initialBucketId={planModal.bucketId}
        onClose={() => setPlanModal({ open: false })}
      />
    </>
  );
}
