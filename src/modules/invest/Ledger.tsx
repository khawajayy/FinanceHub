import { motion } from "framer-motion";
import { BarChart3, BookOpen, ChevronDown, Download, Layers, Pencil, Plus, Trash2, Upload, Timer } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import LE, { type Txn, type SellGroup } from "@/engine/ledger-engine.js";
import { Card, CardHeader, Empty, Tag, TYPE_TAG } from "@/components/ui";
import { cx, downloadFile, fmtNum, fmtPct, fmtPrice, fmtUSD, formatDurationDays, signed, tone } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { ledgerTradeDays, normalizeSynced, useInvest } from "@/stores/invest";
import { confirmDialog, toast } from "@/stores/ui";
import { PageTitle } from "@/modules/expenses/common";
import { Arrow, RangeBar, Sec, useRange } from "./common";

const fmtDate = (d: string) => new Date(d).toLocaleString([], { year: "2-digit", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const HoldTag = ({ days, title }: { days: number; title: string }) => days > 0 ? <Tag className="!normal-case" title={title}><Timer size={10} />{formatDurationDays(days)}</Tag> : null;

function A({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-line/[.03] p-4 ring-1 ring-line/5">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-1.5 text-lg font-semibold">{children}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default function Ledger() {
  const state = useInvest();
  const { transactions, assets, prefs, setPrefs, mutate, replaceAll } = state;
  const openInvest = useActions((s) => s.openInvest);
  const R = useRange();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const res = useMemo(() => LE.computeClosedTradesAndAnalytics(transactions, R, assets), [transactions, R, assets]);
  const a = res.analytics;
  const has = a.totalClosedTrades > 0;
  const inRange = (t: { date: string }) => R.isAll || (new Date(t.date).getTime() >= R.startTs && new Date(t.date).getTime() <= R.endTs);
  const sym = (id?: string) => ((id && assets[id]?.symbol) || id || "").toUpperCase();

  type Row = { kind: "txn"; date: string; seq: number; t: Txn } | { kind: "group"; date: string; seq: number; g: SellGroup };
  const rows: Row[] = useMemo(() => {
    if (prefs.combineSells) {
      const items: Row[] = transactions.filter((t) => t.type !== "SELL" && inRange(t)).map((t) => ({ kind: "txn", date: t.date, seq: t._seq || 0, t }));
      for (const g of res.inRangeGroups) items.push({ kind: "group", date: g.latestDate, seq: g.items[g.items.length - 1].txn._seq || 0, g });
      return items.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime() || y.seq - x.seq);
    }
    return transactions.filter(inRange).map((t) => ({ kind: "txn" as const, date: t.date, seq: t._seq || 0, t }))
      .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime() || y.seq - x.seq);
   
  }, [transactions, res, prefs.combineSells, R]);

  const del = async (id: string) => {
    if (await confirmDialog("Delete transaction", "Delete this transaction? This cannot be undone.", { confirmText: "Delete", danger: true })) {
      mutate((d) => { d.transactions = d.transactions.filter((x) => x.id !== id); }); toast("Deleted");
    }
  };
  const delGroup = async (g: SellGroup) => {
    if (await confirmDialog("Delete combined trade", `Delete all ${g.items.length} partial sell transactions in this trade?`, { confirmText: "Delete all", danger: true })) {
      const ids = new Set(g.items.map((i) => i.txn.id));
      mutate((d) => { d.transactions = d.transactions.filter((x) => !ids.has(x.id)); }); toast(`Deleted ${ids.size} transactions`);
    }
  };

  const exportJSON = () => {
    const { transactions, assets, settings, goals, favorites, dataUpdatedAt } = useInvest.getState();
    downloadFile(`nexus-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ transactions, assets, settings, goals, favorites, dataUpdatedAt }, null, 2), "application/json");
  };
  const importJSON = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = () => {
      const f = inp.files?.[0]; if (!f) return;
      if (f.size > 10 * 1024 * 1024) { toast("Import failed: file is larger than 10 MB", true); return; }
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const s = JSON.parse(String(rd.result));
          if (!s || typeof s !== "object" || !Array.isArray(s.transactions)) throw new Error("not a ledger backup");
          if (!(await confirmDialog("Import backup", `Replace ALL current ledger data with this backup (${s.transactions.length} transactions)?`, { confirmText: "Replace", danger: true }))) return;
          const n = normalizeSynced(s);
          replaceAll(n);
          toast(n.dropped ? `Imported · skipped ${n.dropped} invalid transaction(s)` : "Data imported", !!n.dropped);
          useInvest.getState().refreshPrices();
        } catch (e) { toast("Import failed: " + (e as Error).message, true); }
      };
      rd.readAsText(f);
    };
    inp.click();
  };

  const txnRow = (t: Txn, indent = false, label?: ReactNode) => {
    let detail: ReactNode, amount: number | null, showNote = false;
    if (t.type === "DEPOSIT" || t.type === "WITHDRAW") { detail = t.note || `Cash ${t.type.toLowerCase()}`; amount = t.amount! * (t.type === "DEPOSIT" ? 1 : -1); }
    else if (t.type === "ADJUST") {
      showNote = true;
      if (t.target === "cash") { detail = `Cash adjustment (${t.delta! >= 0 ? "added" : "removed"})`; amount = t.delta!; }
      else { detail = `${t.qtyDelta! >= 0 ? "+" : "−"}${fmtNum(Math.abs(t.qtyDelta!))} ${sym(t.assetId)} (holding adjustment)`; amount = null; }
    } else {
      showNote = true;
      const gross = t.qty! * t.price!, fee = t.fee || 0;
      detail = <>{fmtNum(t.qty!)} <b>{sym(t.assetId)}</b> @ {fmtPrice(t.price!)}{fee ? ` · fee ${fmtUSD(fee)}` : ""}</>;
      amount = t.type === "BUY" ? -(gross + fee) : gross - fee;
    }
    const pl = t.type === "SELL" ? res.realizedByTxn[t.id] : null;
    return (
      <tr key={t.id} className={cx(indent && "bg-line/[.02]")}>
        <td className={cx("text-xs text-muted", indent && "!pl-8")}>{indent && "↳ "}{fmtDate(t.date)}</td>
        <td><div className="flex items-center gap-1">{label ?? <Tag className={TYPE_TAG[t.type]}>{t.type}</Tag>}{t.type === "SELL" && <HoldTag days={(res.holdingMsByTxn[t.id] || 0) / 86400000} title="Holding duration" />}</div></td>
        <td className="max-w-[340px] truncate whitespace-normal">{detail}{t.note && showNote && <span className="text-xs text-muted"> — {t.note}</span>}</td>
        <td className={cx("num text-right", amount == null ? "text-muted" : tone(amount))}>{amount == null ? "—" : signed(amount) + fmtUSD(amount)}</td>
        <td className={cx("num text-right", pl == null ? "text-muted" : tone(pl))}>{pl == null ? "—" : <><Arrow n={pl} />{fmtUSD(Math.abs(pl))}</>}</td>
        <td className="w-px text-right"><div className="inline-flex">
          <button className="icon-btn" title="Edit" onClick={() => openInvest(t)}><Pencil size={14} /></button>
          <button className="icon-btn hover:!text-neg" title="Delete" onClick={() => del(t.id)}><Trash2 size={14} /></button>
        </div></td>
      </tr>
    );
  };

  const groupRows = (g: SellGroup) => {
    if (!g.isCombined) return txnRow(g.items[0].txn);
    const open = !!expanded[g.id];
    return (
      <Fragment key={g.id}>
        <tr className="cursor-pointer bg-violet/[.04]" onClick={() => setExpanded({ ...expanded, [g.id]: !open })}>
          <td className="text-xs text-muted">{fmtDate(g.latestDate)}{g.earliestDate !== g.latestDate && <div className="text-[10px]">started {new Date(g.earliestDate).toLocaleDateString([], { month: "short", day: "numeric" })}</div>}</td>
          <td><div className="flex flex-wrap items-center gap-1"><Tag className={TYPE_TAG.SELL}>SELL</Tag><Tag className="!bg-violet/12 !text-violet"><Layers size={10} />{g.items.length} parts</Tag><HoldTag days={g.holdingTimeDays} title="Avg holding duration" /></div></td>
          <td className="whitespace-normal"><b className="num">{fmtNum(g.totalQty)}</b> <b>{g.symbol.toUpperCase()}</b> @ avg {fmtPrice(g.avgPrice)}{g.totalFees ? ` · fee ${fmtUSD(g.totalFees)}` : ""}
            <div className="text-[11px] text-muted">{g.items.map((i) => `${fmtNum(i.qty)} @ ${fmtPrice(i.price)}`).join(" + ")}</div></td>
          <td className={cx("num text-right", tone(g.totalCashImpact))}>{signed(g.totalCashImpact)}{fmtUSD(g.totalCashImpact)}</td>
          <td className={cx("num text-right font-semibold", tone(g.collectiveRealized))}><Arrow n={g.collectiveRealized} />{fmtUSD(Math.abs(g.collectiveRealized))}<div className="text-[11px] font-normal">{fmtPct(g.collectiveReturnPct)}</div></td>
          <td className="w-px text-right" onClick={(e) => e.stopPropagation()}><div className="inline-flex">
            <button className="icon-btn" title={open ? "Hide fills" : "Show fills"} onClick={() => setExpanded({ ...expanded, [g.id]: !open })}><motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={15} /></motion.span></button>
            <button className="icon-btn hover:!text-neg" title={`Delete all ${g.items.length} fills`} onClick={() => delGroup(g)}><Trash2 size={14} /></button>
          </div></td>
        </tr>
        {open && g.items.map((it, idx) => txnRow(it.txn, true, <Tag className="!normal-case">fill {idx + 1}/{g.items.length}</Tag>))}
      </Fragment>
    );
  };

  const winPct = has ? (a.winTrades / a.totalClosedTrades) * 100 : 0, lossPct = has ? (a.lossTrades / a.totalClosedTrades) * 100 : 0;
  const ratio = (v: number | null, suffix = "") => (v === null ? "—" : v === Infinity ? "∞" : v.toFixed(2) + suffix);

  return (
    <>
      <PageTitle title="Ledger" sub="Every deposit, trade and adjustment — with closed-trade analytics" />
      <RangeBar />
      <Card className="mb-4">
        <CardHeader title={<>Trade analytics {!R.isAll && <span className="chip ml-1">{R.label}</span>}</>} icon={<BarChart3 size={16} />}
          right={<span className="text-xs text-muted">{has ? `${a.totalClosedTrades} closed trade${a.totalClosedTrades === 1 ? "" : "s"}` : "No closed trades in this period"}</span>} />
        <div className="grid gap-5 p-5 md:grid-cols-3">
          <div>
            <div className="label">Win rate</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cx("num text-4xl font-semibold", !has ? "text-muted" : a.winRatePct >= 50 ? "pos" : "neg")}>{has ? a.winRatePct.toFixed(1) + "%" : "—"}</span>
              {has && <span className="chip">{a.winTrades}W · {a.lossTrades}L{a.beTrades ? ` · ${a.beTrades}BE` : ""}</span>}
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-line/10">
              <motion.div className="bg-pos" initial={{ width: 0 }} animate={{ width: `${winPct}%` }} transition={{ duration: 1 }} />
              <motion.div className="bg-neg" initial={{ width: 0 }} animate={{ width: `${lossPct}%` }} transition={{ duration: 1, delay: 0.1 }} />
            </div>
          </div>
          <div>
            <div className="label">Net realized P&L</div>
            <div className={cx("num mt-1 text-3xl font-semibold", tone(a.netRealized))}><Arrow n={a.netRealized} />{fmtUSD(Math.abs(a.netRealized))}</div>
            <div className="text-xs text-muted">{has ? `${fmtPct(a.avgReturnPct)} avg return per trade` : "from closed positions"}</div>
            {has && <Sec usd={a.netRealized} colored />}
          </div>
          <div>
            <div className="label">Profit factor</div>
            <div className="num mt-1 text-3xl font-semibold">{ratio(a.profitFactor)}</div>
            <div className={cx("num text-xs", tone(a.expectancy))}>{has ? <><Arrow n={a.expectancy} />{fmtUSD(Math.abs(a.expectancy))} expectancy / trade</> : "gross gains ÷ gross losses"}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t hairline p-5 lg:grid-cols-4">
          <A label="Winning trades" sub={<span className="pos">+{fmtUSD(a.winAmount)} won</span>}><span className="pos num">{a.winTrades}</span></A>
          <A label="Losing trades" sub={<span className="neg">-{fmtUSD(a.lossAmount)} lost</span>}><span className="neg num">{a.lossTrades}</span></A>
          <A label="Avg win / avg loss" sub={<>payout ratio <b>{ratio(a.winLossRatio, "x")}</b></>}><span className="num text-base"><span className="pos">+{fmtUSD(a.avgWin)}</span> / <span className="neg">-{fmtUSD(a.avgLoss)}</span></span></A>
          <A label="Best / worst" sub={a.worstTrade ? <span className="neg">worst -{fmtUSD(Math.abs(a.worstTrade.collectiveRealized))} ({a.worstTrade.symbol.toUpperCase()})</span> : "no losing trades"}>
            {a.bestTrade ? <span className="num pos text-base">+{fmtUSD(a.bestTrade.collectiveRealized)} <small className="text-muted">({a.bestTrade.symbol.toUpperCase()})</small></span> : <span className="text-muted">—</span>}
          </A>
          <A label="Volume & fees" sub={<>fees {fmtUSD(a.totalFees)} · {a.beTrades} breakeven</>}><span className="num">{fmtUSD(a.totalVolume)}</span></A>
          <A label="Expectancy" sub="avg profit per trade"><span className={cx("num", tone(a.expectancy))}><Arrow n={a.expectancy} />{fmtUSD(Math.abs(a.expectancy))}</span></A>
          <A label="Avg time / profitable trade" sub={a.winTrades ? (R.isAll ? "used by Goals" : `Goals use all-time (${formatDurationDays(ledgerTradeDays(state).days)})`) : "no wins yet"}>
            <span className="num">{formatDurationDays(a.avgHoldingTimeProfitableDays)}</span></A>
          <A label="Avg time / any trade" sub="FIFO-matched holding time"><span className="num">{formatDurationDays(a.avgHoldingTimeAllDays)}</span></A>
        </div>
      </Card>

      <Card>
        <CardHeader title={<>Transaction ledger {!R.isAll && <span className="chip ml-1">{R.label}</span>}</>} icon={<BookOpen size={16} />}
          right={<>
            <button className={cx("btn btn-sm", prefs.combineSells && "!bg-violet/15 !text-violet ring-1 ring-violet/30")} onClick={() => { setPrefs({ combineSells: !prefs.combineSells }); toast(!prefs.combineSells ? "Combining successive partial sells" : "Showing every transaction"); }}>
              <Layers size={13} /> {prefs.combineSells ? "Combined sells" : "Combine sells"}</button>
            <button className="btn btn-sm" onClick={exportJSON}><Download size={13} /> Export</button>
            <button className="btn btn-sm" onClick={importJSON}><Upload size={13} /> Import</button>
            <button className="btn btn-sm btn-primary" onClick={() => openInvest()}><Plus size={13} /> Add</button>
          </>} />
        {!rows.length ? <Empty icon="🧾" title={R.isAll ? "No transactions yet" : "No transactions in this range"} sub={R.isAll ? "Start by adding a Deposit for your initial capital." : "Pick a wider range, or All."} /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Type</th><th>Details</th><th className="!text-right">Cash impact</th><th className="!text-right">Realized P/L</th><th /></tr></thead>
              <tbody>{rows.map((r) => (r.kind === "txn" ? txnRow(r.t) : groupRows(r.g)))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
