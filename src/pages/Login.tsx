import { motion } from "framer-motion";
import { LineChart, ShieldCheck, Wallet, Zap } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/Shell";
import { useAuth } from "@/stores/auth";

const FEATURES = [
  { icon: <Wallet size={16} />, t: "Expenses & net worth", s: "Monthly cash flow, categories, debts, PF projections" },
  { icon: <LineChart size={16} />, t: "Crypto & stock ledger", s: "Live prices, P&L vs capital, trade analytics, goals" },
  { icon: <ShieldCheck size={16} />, t: "Private by design", s: "Your Google account only — synced across devices" },
];

export default function Login() {
  const signIn = useAuth((s) => s.signIn);
  const [busy, setBusy] = useState(false);
  return (
    <div className="relative z-10 grid min-h-screen place-items-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong w-full max-w-md rounded-[2rem] p-8 shadow-2xl sm:p-10">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="font-display text-2xl font-bold tracking-tight">Nexus</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">Personal Finance OS</div>
          </div>
        </div>
        <h1 className="mt-8 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Every rupee and every <span className="gradient-text">trade</span>, in one place.
        </h1>
        <div className="mt-7 space-y-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.t} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.1 }}
              className="flex items-start gap-3 rounded-2xl bg-line/[.03] p-3 ring-1 ring-line/5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan/10 text-cyan">{f.icon}</span>
              <div><div className="text-sm font-semibold">{f.t}</div><div className="text-xs text-muted">{f.s}</div></div>
            </motion.div>
          ))}
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={busy}
          onClick={async () => { setBusy(true); await signIn(); setBusy(false); }}
          className="btn btn-primary mt-8 w-full !py-3.5 !text-[15px]">
          {busy ? <Zap size={18} className="animate-pulse" /> : (
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#04131a" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" /></svg>
          )}
          {busy ? "Opening Google…" : "Continue with Google"}
        </motion.button>
        <p className="mt-4 text-center text-[11.5px] text-muted">Use the same Google account as CryptoLedger to bring your portfolio along.</p>
      </motion.div>
    </div>
  );
}
