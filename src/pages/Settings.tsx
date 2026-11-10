import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Building2, ChevronRight, Lock, LogOut, Moon, MoonStar, Palette, Plus, RotateCcw, Settings2, ShoppingBag, Sun, Tags, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, Segmented } from "@/components/ui";
import { CATEGORIES, DEBT_CATEGORY, bucketSummary, orderBanks, type Category } from "@/engine/expense-engine";
import { cx, fmtRs } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { useExpenses } from "@/stores/expenses";
import { confirmDialog, toast, useUi } from "@/stores/ui";
import { PageTitle } from "@/modules/expenses/common";

/** A row in the category editor. `orig` is the saved name, so a rename can be carried over to old transactions. */
interface Draft extends Category { id: number; orig: string | null }

let seq = 0;
/** Reuses row ids by name so saving or discarding doesn't remount (and re-animate) every row. */
const toDrafts = (cats: readonly Category[], prev: Draft[] = []): Draft[] =>
  cats.map((c) => ({ ...c, id: prev.find((p) => p.key.trim() === c.key)?.id ?? ++seq, orig: c.key }));
const PALETTE = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#22d3ee", "#f87171", "#fb923c", "#94a3b8"];

function CategoryEditor() {
  const categories = useExpenses((s) => s.categories);
  const txns = useExpenses((s) => s.txns);
  const saveCategories = useExpenses((s) => s.saveCategories);
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(categories));
  useEffect(() => setDrafts((prev) => toDrafts(categories, prev)), [categories]);

  const usage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of txns) if (t.direction === "OUT" && t.category) m[t.category] = (m[t.category] || 0) + 1;
    return m;
  }, [txns]);

  const dirty = JSON.stringify(drafts.map(({ key, emoji, color }) => [key, emoji, color])) !== JSON.stringify(categories.map(({ key, emoji, color }) => [key, emoji, color]));
  const patch = (id: number, p: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, dir: -1 | 1) => setDrafts((d) => {
    const j = i + dir;
    if (j < 0 || j >= d.length) return d;
    const next = [...d]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const add = () => setDrafts((d) => [...d, { id: ++seq, orig: null, key: "", emoji: "🏷️", color: PALETTE[d.length % PALETTE.length] }]);

  const save = async () => {
    const names = drafts.map((d) => d.key.trim());
    if (names.some((n) => !n)) { toast("Every category needs a name.", true); return; }
    const dupe = names.find((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i);
    if (dupe) { toast(`"${dupe}" is listed twice.`, true); return; }

    const renames: Record<string, string> = {};
    for (const d of drafts) if (d.orig && d.orig !== d.key.trim()) renames[d.orig] = d.key.trim();
    const kept = new Set(drafts.map((d) => d.orig).filter(Boolean));
    const removed = categories.map((c) => c.key).filter((k) => !kept.has(k));
    const affected = removed.reduce((n, k) => n + (usage[k] || 0), 0) + Object.keys(renames).reduce((n, k) => n + (usage[k] || 0), 0);

    if (removed.some((k) => usage[k])) {
      const list = removed.filter((k) => usage[k]).map((k) => `"${k}" (${usage[k]})`).join(", ");
      if (!(await confirmDialog("Remove categories", `${list} still have transactions. They'll show as Uncategorised.`, { confirmText: "Remove and save", danger: true }))) return;
    }
    await saveCategories(drafts.map((d) => ({ key: d.key.trim(), emoji: d.emoji, color: d.color })), renames, removed);
    toast(affected ? `Categories saved · ${affected} transaction${affected === 1 ? "" : "s"} updated` : "Categories saved");
  };

  return (
    <Card className="lg:col-span-2" delay={0.05}>
      <CardHeader title="Expense categories" icon={<Tags size={16} />} sub="Rename, recolour, reorder, add or remove. Renames carry over to past transactions."
        right={<button className="btn btn-sm btn-ghost" onClick={() => setDrafts((prev) => toDrafts(CATEGORIES, prev))} title="Load the original seven categories (not saved until you press Save)"><RotateCcw size={13} /> Defaults</button>} />
      <div className="divide-y divide-line/5">
        <AnimatePresence initial={false}>
          {drafts.map((d, i) => {
            const locked = d.orig === DEBT_CATEGORY;
            return (
              <motion.div key={d.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} className="group flex items-center gap-2 px-4 py-2 sm:px-5">
                <div className="flex flex-col">
                  <button className="icon-btn !h-5 !w-6 disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={12} /></button>
                  <button className="icon-btn !h-5 !w-6 disabled:opacity-20" disabled={i === drafts.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={12} /></button>
                </div>
                <input className="input !w-12 !px-0 !py-1.5 text-center text-lg" value={d.emoji} onChange={(e) => patch(d.id, { emoji: e.target.value })} maxLength={8} aria-label="Emoji" />
                <label className="relative h-8 w-8 shrink-0 cursor-pointer rounded-full ring-1 ring-line/20" style={{ background: d.color }} title="Colour">
                  <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={d.color} onChange={(e) => patch(d.id, { color: e.target.value })} aria-label="Colour" />
                </label>
                <div className="relative min-w-0 flex-1">
                  <input className={cx("input !py-1.5", locked && "!pr-8 text-muted")} value={d.key} readOnly={locked} onChange={(e) => patch(d.id, { key: e.target.value })} placeholder="Category name" maxLength={80}
                    title={locked ? "Used by Repay on the Net Worth page, so the name is fixed" : undefined} />
                  {locked && <Lock size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />}
                </div>
                <span className="num hidden w-14 shrink-0 text-right text-xs text-muted sm:block" title="Transactions using this category">{d.orig && usage[d.orig] ? usage[d.orig] : ""}</span>
                <button className="icon-btn opacity-60 hover:!text-neg group-hover:opacity-100 disabled:invisible" disabled={locked} onClick={() => setDrafts((x) => x.filter((y) => y.id !== d.id))} title="Remove"><Trash2 size={15} /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t hairline p-4">
        <button className="btn btn-sm" onClick={add}><Plus size={13} /> Add category</button>
        <div className="ml-auto flex gap-2">
          {dirty && <button className="btn btn-sm btn-ghost" onClick={() => setDrafts((prev) => toDrafts(categories, prev))}>Discard</button>}
          <button className="btn btn-sm btn-primary" disabled={!dirty} onClick={save}>Save categories</button>
        </div>
      </div>
    </Card>
  );
}

/** Order in which transactions draw from bank accounts, plus the auto-deduct switch. Saves on every change. */
function BankPriority() {
  const accounts = useExpenses((s) => s.accounts);
  const priority = useExpenses((s) => s.bankPriority);
  const autoBank = useExpenses((s) => s.autoBank);
  const setPriority = useExpenses((s) => s.setBankPriority);
  const setAutoBank = useExpenses((s) => s.setAutoBank);
  const banks = orderBanks(accounts, priority);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= banks.length) return;
    const ids = banks.map((b) => b.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setPriority(ids);
    toast(`${banks[i].name} is now #${j + 1}`);
  };
  const toggle = () => { setAutoBank(!autoBank); toast(autoBank ? "Auto-deduct off" : "Auto-deduct on"); };

  return (
    <Card delay={0.04}>
      <CardHeader title="Bank accounts" icon={<Building2 size={16} />} sub="Transactions update your Net Worth bank balances" />
      <div className={cx("mx-4 mt-4 flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors sm:mx-5", autoBank ? "bg-cyan/10 ring-cyan/30" : "bg-line/[.03] ring-line/5")}>
        <button type="button" role="switch" aria-checked={autoBank} aria-label="Auto-deduct from bank accounts" onClick={toggle}
          className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", autoBank ? "bg-cyan" : "bg-line/20")}>
          <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", autoBank ? "left-[22px]" : "left-0.5")} />
        </button>
        <div className="min-w-0 text-sm">
          <div className="font-semibold">Auto-deduct</div>
          <div className="text-[11.5px] text-muted">{autoBank
            ? "Spending comes out of #1 first; when it runs dry the rest comes from #2, and so on. Income goes into #1."
            : "Off: balances only change when you pick a bank on a transaction."}</div>
        </div>
      </div>
      <div className="divide-y divide-line/5 py-2">
        {banks.length === 0 && <div className="px-5 py-3 text-sm text-muted">No bank accounts yet. <Link to="/expenses/networth" className="underline">Add one on Net Worth</Link>.</div>}
        <AnimatePresence initial={false}>
          {banks.map((b, i) => (
            <motion.div key={b.id} layout className="flex items-center gap-2 px-4 py-2 sm:px-5">
              <div className="flex flex-col">
                <button className="icon-btn !h-5 !w-6 disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${b.name} up`}><ArrowUp size={12} /></button>
                <button className="icon-btn !h-5 !w-6 disabled:opacity-20" disabled={i === banks.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${b.name} down`}><ArrowDown size={12} /></button>
              </div>
              <span className={cx("chip !py-0.5 !text-[10px]", i === 0 && "!text-cyan")}>#{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
              <span className={cx("num text-sm", b.balance < 0 && "neg")}>{fmtRs(b.balance)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function BucketsSummary() {
  const buckets = useExpenses((s) => s.buckets);
  const txns = useExpenses((s) => s.txns);
  return (
    <Card delay={0.1}>
      <CardHeader title="Buckets" icon={<ShoppingBag size={16} />} sub="Temporary groups like a trip or event" right={<Link to="/expenses/buckets" className="btn btn-sm">Manage</Link>} />
      <div className="divide-y divide-line/5">
        {buckets.length === 0 && <div className="px-5 py-4 text-sm text-muted">No buckets yet.</div>}
        {buckets.map((b) => (
          <Link key={b.id} to="/expenses/buckets" className="flex items-center gap-3 px-5 py-2.5 text-sm transition hover:bg-line/[.03]">
            <span>{b.emoji}</span><span className="truncate">{b.name}</span>
            {b.status === "closed" && <span className="chip !py-0.5 !text-[10px]">Closed</span>}
            <span className="num ml-auto font-semibold">{fmtRs(bucketSummary(txns, b.id).net)}</span>
            <ChevronRight size={14} className="text-muted" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function Settings() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);

  const out = async () => { if (await confirmDialog("Sign out", "Sign out of Nexus on this device?", { confirmText: "Sign out" })) signOut(); };

  return (
    <>
      <PageTitle title="Settings" sub="Categories, bank priority, buckets, appearance and account" />
      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <Card delay={0}>
          <CardHeader title="Appearance" icon={<Palette size={16} />} />
          <div className="flex items-center gap-3 p-5 text-sm">
            <span className="text-muted">Theme</span>
            <Segmented id="settings-theme" className="ml-auto" value={theme} onChange={(v) => setTheme(v)} options={[
              { value: "dark", label: <span className="flex items-center gap-1.5"><Moon size={14} /> Dark</span> },
              { value: "black", label: <span className="flex items-center gap-1.5"><MoonStar size={14} /> Black</span> },
              { value: "light", label: <span className="flex items-center gap-1.5"><Sun size={14} /> Light</span> },
            ]} />
          </div>
        </Card>
        <Card delay={0.03}>
          <CardHeader title="Account" icon={<UserRound size={16} />} />
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-center gap-3">
              {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-xl" /> : null}
              <div className="min-w-0"><div className="truncate font-medium">{user?.displayName || "Signed in"}</div><div className="truncate text-xs text-muted">{user?.email}</div></div>
              <button className="btn btn-sm ml-auto" onClick={out}><LogOut size={13} /> Sign out</button>
            </div>
            <Link to="/invest/settings" className="flex items-center gap-2 rounded-xl px-3 py-2 text-muted ring-1 ring-line/10 transition hover:text-ink">
              <Settings2 size={14} /> Investment settings (API key, currency, backups) <ChevronRight size={14} className="ml-auto" />
            </Link>
          </div>
        </Card>
        <CategoryEditor />
        <BankPriority />
        <BucketsSummary />
      </div>
    </>
  );
}
