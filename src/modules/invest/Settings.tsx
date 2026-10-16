import { Cloud, KeyRound, RefreshCw, Trash2, Banknote } from "lucide-react";
import { useEffect, useState } from "react";
import { AmountInput, Card, CardHeader, Field } from "@/components/ui";
import { fmtAmtStr, stripNum } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { DEFAULT_SETTINGS, useInvest } from "@/stores/invest";
import { confirmDialog, toast } from "@/stores/ui";
import { PageTitle } from "@/modules/expenses/common";

const CURRENCIES = [["PKR", "Pakistani Rupee"], ["INR", "Indian Rupee"], ["AED", "UAE Dirham"], ["GBP", "British Pound"], ["EUR", "Euro"], ["CAD", "Canadian Dollar"], ["SAR", "Saudi Riyal"], ["JPY", "Japanese Yen"]];

export default function InvestSettings() {
  const settings = useInvest((s) => s.settings);
  const fx = useInvest((s) => s.fx);
  const cloud = useInvest((s) => s.cloudStatus);
  const mutate = useInvest((s) => s.mutate);
  const ensureFx = useInvest((s) => s.ensureFx);
  const refresh = useInvest((s) => s.refreshPrices);
  const user = useAuth((s) => s.user);

  const [key, setKey] = useState(settings.finnhubKey);
  const [cur, setCur] = useState(settings.secondaryCurrency);
  const [manual, setManual] = useState(!!settings.manualRate);
  const [rate, setRate] = useState("");
  const [auto, setAuto] = useState(settings.autoRefreshSec);
  const live = fx.rates[cur];

  useEffect(() => {
    setKey(settings.finnhubKey); setCur(settings.secondaryCurrency); setManual(!!settings.manualRate); setAuto(settings.autoRefreshSec);
    setRate(settings.manualRate ? fmtAmtStr(settings.manualRate) : fx.rates[settings.secondaryCurrency] != null ? fmtAmtStr(+fx.rates[settings.secondaryCurrency].toFixed(2)) : "");
  }, [settings, fx.rates]);

  const save = () => {
    let manualRate: number | null = null;
    if (manual) {
      const v = stripNum(rate);
      if (!(v > 0)) { toast("Enter a positive rate, or turn off the override", true); return; }
      manualRate = v;
    }
    const curChanged = cur !== settings.secondaryCurrency;
    if (curChanged) manualRate = null; // a manual rate belongs to the currency it was set for
    mutate((d) => { d.settings = { ...d.settings, finnhubKey: key.trim().replace(/[^\x21-\x7E]/g, "").slice(0, 128), secondaryCurrency: cur, manualRate, autoRefreshSec: auto }; });
    toast("Settings saved");
    if (curChanged) ensureFx(true);
    if (key.trim()) refresh();
  };

  const reset = async () => {
    if (!(await confirmDialog("Reset investment data", "Delete ALL ledger transactions, goals, watchlist and settings — on every device? Export a backup from the Ledger first. This cannot be undone.", { confirmText: "Delete everything", danger: true }))) return;
    mutate((d) => { d.transactions = []; d.assets = Object.create(null); d.goals = []; d.favorites = []; d.settings = { ...DEFAULT_SETTINGS }; });
    toast("All investment data cleared");
  };

  return (
    <>
      <PageTitle title="Settings" sub="Investment module preferences" />
      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cloud sync" icon={<Cloud size={16} />} />
          <div className="space-y-2 p-5 text-sm">
            <div>Signed in as <b>{user?.email}</b></div>
            <div className="text-muted">Status: <span className="text-cyan">{cloud || "—"}</span>. Your ledger, goals and watchlist sync in real time across devices; prices and charts history are cached per device.</div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Finnhub API key" icon={<KeyRound size={16} />} />
          <div className="p-5">
            <Field label="Key (for live stock prices, search & news)" hint={<>Get a free key at <a className="text-cyan underline" href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer">finnhub.io/register</a>. Crypto prices via Binance need no key.</>}>
              <input className="input num" value={key} onChange={(e) => setKey(e.target.value)} placeholder="paste your free key" autoComplete="off" spellCheck={false} />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Secondary currency" icon={<Banknote size={16} />} />
          <div className="space-y-4 p-5">
            <Field label="Shown under USD figures" hint="Live USD rates via open.er-api.com (free, no key).">
              <select className="input" value={cur} onChange={(e) => setCur(e.target.value)}>
                {CURRENCIES.map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}
              </select>
            </Field>
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Override rate manually</label>
              <AmountInput className="mt-2" value={rate} onChange={setRate} disabled={!manual} placeholder="e.g. 285" style={{ opacity: manual ? 1 : 0.5 }} />
              <p className="mt-1.5 text-[11.5px] text-muted">{manual ? `Using your fixed rate.${live != null ? ` Live market rate is ${live.toLocaleString(undefined, { maximumFractionDigits: 2 })}.` : ""}`
                : `Following the live rate${live != null ? ` (${live.toLocaleString(undefined, { maximumFractionDigits: 2 })})` : ""}. Pin your own, e.g. your USDT conversion rate.`}</p>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Prices" icon={<RefreshCw size={16} />} />
          <div className="p-5">
            <Field label="Auto-refresh">
              <select className="input" value={auto} onChange={(e) => setAuto(parseInt(e.target.value, 10))}>
                <option value={0}>Off (manual only)</option><option value={30}>Every 30 seconds</option><option value={60}>Every minute</option><option value={300}>Every 5 minutes</option>
              </select>
            </Field>
          </div>
        </Card>
      </div>
      <div className="mt-4 flex max-w-5xl flex-wrap gap-2">
        <button className="btn btn-primary" onClick={save}>Save settings</button>
        <button className="btn btn-danger ml-auto" onClick={reset}><Trash2 size={15} /> Reset investment data</button>
      </div>
    </>
  );
}
