import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import LE, { type Asset, type AssetType, type Txn, type TxType } from "@/engine/ledger-engine.js";
import { AmountInput, Field, Modal, Segmented, Warn } from "@/components/ui";
import { cx, fmtAmtStr, fmtNum, fmtPrice, fmtUSD, signed, stripNum, tone } from "@/lib/format";
import { fetchLivePrice } from "@/lib/market";
import { useActions } from "@/stores/actions";
import { heldAssets, summarize, useInvest } from "@/stores/invest";
import { toast } from "@/stores/ui";
import { AssetSearch } from "./AssetSearch";

const EPS = LE.EPS;
const toLocalInput = (iso: string) => {
  const d = new Date(iso), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const ok = (x: number) => Number.isFinite(x) && x > 0;
const trim = (x: number, d: number) => (Number.isFinite(x) ? fmtAmtStr(+x.toFixed(d)) : "");

function Chip({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex-1 rounded-xl bg-line/[.04] px-3 py-2 ring-1 ring-line/5"><div className="text-[10.5px] text-muted">{label}</div><div className="num text-sm font-semibold">{children}</div></div>;
}

export function InvestTxnModal() {
  const { open, txn, prefill } = useActions((s) => s.investModal);
  const close = useActions((s) => s.closeInvest);
  const st = useInvest();
  const editingId = txn?.id ?? null;

  const [type, setType] = useState<TxType>("DEPOSIT");
  const [aType, setAType] = useState<AssetType>("crypto");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [searchText, setSearchText] = useState("");
  const [cash, setCash] = useState("");
  const [qty, setQty] = useState(""); const [price, setPrice] = useState(""); const [total, setTotal] = useState(""); const [fee, setFee] = useState("");
  const [pct, setPct] = useState(0); const [sizeHint, setSizeHint] = useState("");
  const [adjTarget, setAdjTarget] = useState<"cash" | "asset">("cash"); const [adjDir, setAdjDir] = useState<"add" | "remove">("add");
  const [adjAsset, setAdjAsset] = useState(""); const [adjAmt, setAdjAmt] = useState("");
  const [date, setDate] = useState(""); const [note, setNote] = useState("");
  const [liveBusy, setLiveBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t: Partial<Txn> & { asset?: Asset } = txn || prefill || {};
    const a = prefill?.asset || (t.assetId ? useInvest.getState().assets[t.assetId] : null) || null;
    setType(t.type || "DEPOSIT"); setAsset(a); setAType(a?.type || "crypto");
    setSearchText(a && t.type !== "ADJUST" ? `${a.symbol.toUpperCase()} — ${a.name}` : "");
    setCash(t.amount ? fmtAmtStr(t.amount) : "");
    setQty(t.qty != null ? fmtAmtStr(+t.qty.toFixed(8)) : ""); setPrice(t.price != null ? fmtAmtStr(t.price) : "");
    setTotal(t.qty && t.price ? fmtAmtStr(+(t.qty * t.price).toFixed(2)) : ""); setFee(t.fee ? fmtAmtStr(t.fee) : "");
    setPct(0); setSizeHint("");
    if (t.type === "ADJUST") {
      setAdjTarget(t.target === "cash" ? "cash" : "asset");
      const d = (t.target === "cash" ? t.delta : t.qtyDelta) || 0;
      setAdjDir(d >= 0 ? "add" : "remove"); setAdjAmt(fmtAmtStr(Math.abs(d))); setAdjAsset(t.assetId || "");
    } else { setAdjTarget("cash"); setAdjDir("add"); setAdjAmt(""); setAdjAsset(""); }
    setDate(toLocalInput(t.date || new Date().toISOString())); setNote(t.note || "");
  }, [open, txn, prefill]);

  const p = useMemo(() => summarize(st, editingId), [st.transactions, st.assets, st.prices, editingId]);
  const held = useMemo(() => heldAssets(st, editingId), [st.transactions, st.assets, editingId]);
  const heldQty = (id?: string | null) => (id && p.positions[id] ? p.positions[id].qty : 0);
  const isCash = type === "DEPOSIT" || type === "WITHDRAW", isTrade = type === "BUY" || type === "SELL";

  useEffect(() => { if (open && type === "ADJUST" && adjTarget === "asset" && !adjAsset && held[0]) setAdjAsset(held[0].id); }, [open, type, adjTarget, adjAsset, held]);

  const pickList = useMemo(() => {
    if (type === "SELL") return held;
    const m: Record<string, Asset> = {};
    held.forEach((a) => (m[a.id] = a)); st.favorites.forEach((f) => (m[f.id] ||= f)); Object.values(st.assets).forEach((a) => (m[a.id] ||= a));
    return Object.values(m);
  }, [type, held, st.favorites, st.assets]);

  // keep qty / price / total consistent (total = qty × price)
  const triad = (edited: "qty" | "price" | "total", q0 = qty, p0 = price, t0 = total) => {
    const q = stripNum(q0), pr = stripNum(p0), t = stripNum(t0);
    if (edited === "qty") { if (ok(q) && ok(pr)) setTotal(trim(q * pr, 2)); else if (ok(q) && ok(t)) setPrice(trim(t / q, 8)); }
    else if (edited === "price") { if (ok(pr) && ok(q)) setTotal(trim(q * pr, 2)); else if (ok(pr) && ok(t)) setQty(trim(t / pr, 8)); }
    else { if (ok(t) && ok(pr)) setQty(trim(t / pr, 8)); else if (ok(t) && ok(q)) setPrice(trim(t / q, 8)); }
  };
  // reflect typed qty/total back onto the slider
  useEffect(() => {
    if (type === "SELL" && asset) { const h = heldQty(asset.id), q = stripNum(qty); if (h > 0 && Number.isFinite(q)) setPct(Math.round(Math.max(0, Math.min(100, (q / h) * 100)))); }
    else if (type === "BUY") { const t = stripNum(total); if (p.cash > 0 && Number.isFinite(t)) setPct(Math.round(Math.max(0, Math.min(100, (t / p.cash) * 100)))); }
  }, [qty, total]);

  const applyPct = (v: number) => {
    v = Math.max(0, Math.min(100, Math.round(v))); setPct(v);
    if (type === "SELL") {
      if (!asset) { setSizeHint("Pick a holding first, then choose a size."); return; }
      const h = heldQty(asset.id), q = +(h * v / 100).toFixed(8), qs = h > 0 ? fmtAmtStr(q) : "";
      setQty(qs); triad("qty", qs);
      setSizeHint(h > 0 ? `Selling ${fmtNum(q)} of ${fmtNum(h)} ${asset.symbol.toUpperCase()} (${v}%)` : "You don't hold this asset.");
    } else if (type === "BUY") {
      const spend = +(p.cash * v / 100).toFixed(2), ts = spend > 0 ? fmtAmtStr(spend) : "";
      setTotal(ts); triad("total", qty, price, ts);
      setSizeHint(`Spending ${fmtUSD(spend)} of ${fmtUSD(p.cash)} cash (${v}%)${stripNum(price) > 0 ? "" : " — set a price to get quantity"}`);
    }
  };

  const pick = (a: Asset) => { setAsset(a); setAType(a.type); setSearchText(`${a.symbol.toUpperCase()} — ${a.name}`); };

  const useLive = async () => {
    if (!asset) { toast("Pick an asset first", true); return; }
    if (asset.type === "stock" && !st.settings.finnhubKey) { toast("Add a Finnhub key in Settings", true); return; }
    setLiveBusy(true);
    try {
      const v = await fetchLivePrice(asset, st.settings.finnhubKey);
      if (v) { const s = fmtAmtStr(v); setPrice(s); triad("price", qty, s); toast(`Live ${asset.symbol.toUpperCase()}: ${fmtPrice(v)}`); }
      else toast("Couldn't get a live price", true);
    } catch (e) { toast("Live price failed: " + (e as Error).message, true); }
    finally { setLiveBusy(false); }
  };

  // derived preview
  const nQty = stripNum(qty) || 0, nPrice = stripNum(price) || 0, nFee = stripNum(fee) || 0, gross = nQty * nPrice;
  const pos = asset ? p.positions[asset.id] : undefined;
  const basisSold = pos && pos.qty > 0 ? (pos.costBasis / pos.qty) * nQty : 0;
  const realized = gross - nFee - basisSold;
  const nCash = stripNum(cash) || 0, nAdj = stripNum(adjAmt) || 0;
  const adjA = adjAsset ? st.assets[adjAsset] : null;

  const save = () => {
    const ms = date ? new Date(date).getTime() : Date.now();
    if (!Number.isFinite(ms)) { toast("Enter a valid date", true); return; }
    const iso = new Date(ms).toISOString();
    const n = note.trim().slice(0, 500);
    let out: Partial<Txn>, newAsset: Asset | null = null;
    if (isCash) {
      const amount = stripNum(cash);
      if (!(amount > 0)) { toast("Enter a positive amount", true); return; }
      if (type === "WITHDRAW" && amount > p.cash + EPS) { toast(`Can't withdraw ${fmtUSD(amount)}; only ${fmtUSD(p.cash)} in cash`, true); return; }
      out = { type, amount, date: iso, note: n };
    } else if (type === "ADJUST") {
      const amount = stripNum(adjAmt);
      if (!(amount > 0)) { toast("Enter a positive amount", true); return; }
      if (adjTarget === "cash") {
        if (adjDir === "remove" && amount > p.cash + EPS) { toast(`Can't remove ${fmtUSD(amount)}; only ${fmtUSD(p.cash)} in cash`, true); return; }
        out = { type, target: "cash", delta: adjDir === "add" ? amount : -amount, date: iso, note: n };
      } else {
        if (!adjAsset || !st.assets[adjAsset]) { toast("No holding selected to adjust", true); return; }
        if (adjDir === "remove" && amount > heldQty(adjAsset) + EPS) { toast(`Can't remove ${fmtNum(amount)}; you only hold ${fmtNum(heldQty(adjAsset))}`, true); return; }
        out = { type, target: "asset", assetId: adjAsset, qtyDelta: adjDir === "add" ? amount : -amount, date: iso, note: n };
      }
    } else {
      if (!asset) { toast("Search and pick an asset", true); return; }
      const q = stripNum(qty), pr = stripNum(price), f = fee.trim() ? stripNum(fee) : 0;
      if (!(q > 0)) { toast("Enter a positive quantity", true); return; }
      if (!(pr > 0)) { toast("Enter a positive price", true); return; }
      if (!(f >= 0)) { toast("Fee must be zero or a positive number", true); return; }
      if (type === "SELL" && q > heldQty(asset.id) + EPS) { toast(`Can't sell ${fmtNum(q)}; you only hold ${fmtNum(heldQty(asset.id))}`, true); return; }
      newAsset = LE.sanitizeAsset(asset);
      if (!newAsset) { toast("That asset can't be tracked", true); return; }
      out = { type, assetId: newAsset.id, qty: q, price: pr, fee: f, date: iso, note: n };
    }
    let missing = false;
    st.mutate((d) => {
      if (newAsset) d.assets[newAsset.id] = newAsset;
      if (editingId) {
        const i = d.transactions.findIndex((x) => x.id === editingId);
        if (i < 0) { missing = true; return; }
        d.transactions[i] = { ...(out as Txn), id: editingId, _seq: d.transactions[i]._seq };
      } else {
        d.transactions.push({ ...(out as Txn), id: LE.makeId(), _seq: d.transactions.reduce((m, t) => Math.max(m, t._seq || 0), -1) + 1 });
      }
    });
    if (missing) toast("That transaction no longer exists (it may have been deleted on another device)", true);
    else toast("Transaction saved");
    close();
    setTimeout(() => useInvest.getState().refreshPrices(), 50);
  };

  const cashChip = <Chip label="Available cash"><span className={cx(p.cash < 0 && "neg")}>{fmtUSD(p.cash)}</span></Chip>;
  const holdChip = (a: Asset | null) => a && <Chip label={`You hold · ${a.symbol.toUpperCase()}`}>{fmtNum(heldQty(a.id))}{st.prices[a.id] && <span className="ml-1 text-xs font-normal text-muted">({fmtUSD(heldQty(a.id) * st.prices[a.id].price)})</span>}</Chip>;

  return (
    <Modal open={open} onClose={close} title={editingId ? "Edit transaction" : "New transaction"} icon={<ArrowLeftRight size={16} />}
      footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={save}>Save transaction</button></>}>
      <Segmented id="ttype" size="sm" className="w-full" value={type} onChange={(v) => { setType(v); setPct(0); setSizeHint(""); }}
        options={(["DEPOSIT", "WITHDRAW", "BUY", "SELL", "ADJUST"] as TxType[]).map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }))} />

      <div className="mt-4 flex gap-2">
        {isCash && cashChip}
        {type === "BUY" && <>{cashChip}{holdChip(asset)}</>}
        {type === "SELL" && <>{holdChip(asset)}{cashChip}</>}
        {type === "ADJUST" && (adjTarget === "cash" ? cashChip : holdChip(adjA))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={isCash ? "cash" : isTrade ? "trade" : "adj"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="mt-4 space-y-4">
          {isCash && <>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted">$</span>
              <AmountInput autoFocus value={cash} onChange={setCash} placeholder="3,000" className="!py-4 !pl-10 !text-2xl font-semibold" aria-label="Amount (USD)" />
            </div>
            {type === "WITHDRAW" && nCash > p.cash + EPS && <Warn>You only have {fmtUSD(p.cash)} in cash to withdraw.</Warn>}
          </>}

          {isTrade && <>
            {pickList.length > 0 && (
              <Field label={type === "SELL" ? "Pick a holding to sell" : "Pick an existing asset"}>
                <select className="input" value={asset && pickList.some((a) => a.id === asset.id) ? asset.id : ""} onChange={(e) => { const a = pickList.find((x) => x.id === e.target.value); if (a) pick(a); }}>
                  <option value="">— pick, or search below —</option>
                  {pickList.map((a) => <option key={a.id} value={a.id}>{a.symbol.toUpperCase()} — {a.name}</option>)}
                </select>
              </Field>
            )}
            <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
              <Segmented id="atype" size="sm" value={aType} onChange={(v) => { setAType(v); setAsset(null); setSearchText(""); }} options={[{ value: "crypto", label: "Crypto" }, { value: "stock", label: "Stock" }]} />
              <AssetSearch key={aType} type={aType} value={searchText} onTextChange={(v) => { setSearchText(v); setAsset(null); }} onPick={pick} placeholder="Or search — bitcoin, INTC, sandisk" />
            </div>
            {asset && <div className="text-xs text-cyan">Tracking {asset.symbol.toUpperCase()} ({asset.type})</div>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity"><AmountInput value={qty} onChange={(v) => { setQty(v); triad("qty", v); }} placeholder="20" /></Field>
              <Field label="Price per unit (USD)">
                <div className="relative"><AmountInput value={price} onChange={(v) => { setPrice(v); triad("price", qty, v); }} placeholder="150" className="!pr-16" />
                  <button type="button" onClick={useLive} disabled={liveBusy} className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-cyan/15 px-2 py-1 text-[10.5px] font-bold text-cyan hover:bg-cyan/25">
                    <Zap size={11} className={cx(liveBusy && "animate-pulse")} />LIVE</button></div>
              </Field>
              <Field label="Total (USD)"><AmountInput value={total} onChange={(v) => { setTotal(v); triad("total", qty, price, v); }} placeholder="auto" /></Field>
              <Field label="Fee (USD, optional)"><AmountInput value={fee} onChange={setFee} placeholder="0" /></Field>
            </div>
            <div>
              <span className="field-label">{type === "SELL" ? "Sell size (% of holding)" : "Buy size (% of cash)"}</span>
              <div className="flex gap-1.5">
                {[0, 25, 50, 75, 100].map((v) => (
                  <button key={v} type="button" onClick={() => applyPct(v)} className={cx("btn btn-sm flex-1", pct === v && "!bg-cyan/15 !text-cyan ring-1 ring-cyan/30")}>{v === 100 ? "Max" : `${v}%`}</button>
                ))}
              </div>
              <input type="range" min={0} max={100} value={pct} onChange={(e) => applyPct(+e.target.value)} className="mt-3 w-full" aria-label="Size" />
              {sizeHint && <div className="text-[11.5px] text-muted">{sizeHint}</div>}
            </div>
            <div className="rounded-2xl bg-gradient-to-r from-cyan/10 to-violet/10 px-4 py-3 text-sm ring-1 ring-cyan/15">
              {type === "BUY"
                ? <>Cost <b className="num">{fmtUSD(gross + nFee)}</b> <span className="text-muted">({fmtNum(nQty)} × {fmtPrice(nPrice)}{nFee ? ` + ${fmtUSD(nFee)} fee` : ""})</span> · cash after <b className={cx("num", p.cash - gross - nFee < 0 && "neg")}>{fmtUSD(p.cash - gross - nFee)}</b></>
                : <>Proceeds <b className="num">{fmtUSD(gross - nFee)}</b> · realized P&L <b className={cx("num", tone(realized))}>{signed(realized)}{fmtUSD(realized)}</b></>}
            </div>
            {type === "BUY" && gross + nFee > p.cash + EPS && <Warn>This buy exceeds your available cash ({fmtUSD(p.cash)}). It's allowed, but cash will go negative.</Warn>}
            {type === "SELL" && asset && nQty > heldQty(asset.id) + EPS && <Warn>You only hold {fmtNum(heldQty(asset.id))} {asset.symbol.toUpperCase()}. Selling more than held isn't allowed.</Warn>}
          </>}

          {type === "ADJUST" && <>
            <Segmented id="adjt" className="w-full" value={adjTarget} onChange={setAdjTarget} options={[{ value: "cash", label: "Cash balance" }, { value: "asset", label: "Holding quantity" }]} />
            {adjTarget === "asset" && (
              <Field label="Holding">
                <select className="input" value={adjAsset} onChange={(e) => setAdjAsset(e.target.value)}>
                  {held.length ? held.map((a) => <option key={a.id} value={a.id}>{a.symbol.toUpperCase()} — {a.name}</option>) : <option value="">(no holdings to adjust)</option>}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-[auto_1fr] items-end gap-3">
              <Segmented id="adjd" value={adjDir} onChange={setAdjDir} options={[{ value: "add", label: "Add" }, { value: "remove", label: "Remove" }]} />
              <Field label={adjTarget === "cash" ? "Amount (USD)" : "Quantity"}><AmountInput value={adjAmt} onChange={setAdjAmt} placeholder="0" /></Field>
            </div>
            <div className="rounded-2xl bg-line/[.04] px-4 py-3 text-sm ring-1 ring-line/5">
              {adjTarget === "cash"
                ? <>Cash {adjDir === "add" ? "increases" : "decreases"} by <b className="num">{fmtUSD(nAdj)}</b> · after <b className="num">{fmtUSD(p.cash + (adjDir === "add" ? nAdj : -nAdj))}</b>
                  <div className="mt-1 text-xs text-muted">Counts toward return, not net capital (use Deposit/Withdraw for your own money).</div></>
                : adjA ? <>{adjA.symbol.toUpperCase()} {adjDir === "add" ? "+" : "−"}{fmtNum(nAdj)} · holding after <b className="num">{fmtNum(heldQty(adjA.id) + (adjDir === "add" ? nAdj : -nAdj))}</b>
                  <div className="mt-1 text-xs text-muted">{adjDir === "add" ? "Added at $0 cost (airdrop / bonus) — raises equity and return." : "Removed at average cost, no realized P&L."}</div></>
                : "Pick a holding to adjust."}
            </div>
            {adjTarget === "cash" && adjDir === "remove" && nAdj > p.cash + EPS && <Warn>You can't remove more than your available cash ({fmtUSD(p.cash)}).</Warn>}
            {adjTarget === "asset" && adjA && adjDir === "remove" && nAdj > heldQty(adjA.id) + EPS && <Warn>You only hold {fmtNum(heldQty(adjA.id))} units of {adjA.symbol.toUpperCase()}.</Warn>}
          </>}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Date & time"><input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Note (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      </div>
    </Modal>
  );
}
