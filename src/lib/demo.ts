/*
 * Dev-only demo mode: open http://localhost:5173/?demo to explore the UI with
 * sample data, without signing in and without touching Firestore.
 * `import.meta.env.DEV` is false in production builds, so this is compiled out.
 */
import type { Account, ExpenseTxn } from "@/engine/expense-engine";
import { pad } from "@/engine/expense-engine";

export const DEMO = import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).has("demo");

const now = new Date();
const ym = (back: number) => { const d = new Date(now.getFullYear(), now.getMonth() - back, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const day = (back: number, d: number) => `${ym(back)}-${pad(Math.min(d, back === 0 ? now.getDate() : 28))}`;
let n = 0;
const t = (back: number, d: number, description: string, amount: number, category: string | null, direction: "IN" | "OUT" = "OUT"): ExpenseTxn =>
  ({ id: `d${++n}`, txn_date: day(back, d), description, amount, category, direction, created_at: n });

const H = "Housing & Utilities", F = "Food & Groceries", O = "Outside Food (Takeaway/Dining Out)", T = "Transport", L = "Health & Lifestyle", S = "Savings, Investment & Other", D = "Debt & Loans";

export function demoExpenses(): { txns: ExpenseTxn[]; accounts: Account[] } {
  const txns: ExpenseTxn[] = [];
  for (let b = 5; b >= 0; b--) {
    const k = 1 + (b % 3) * 0.06;
    txns.push(
      t(b, 1, "Salary", Math.round(310000 * k), null, "IN"), t(b, 1, "Rent Payment", 63125, H), t(b, 2, "Electricity bill", Math.round(18000 * k), H),
      t(b, 3, "Stormfiber", 3400, H), t(b, 4, "Grocery - Imtiaz", Math.round(21000 * k), F), t(b, 6, "Fuel", Math.round(14000 * k), T),
      t(b, 8, "Dinner out", Math.round(7800 * k), O), t(b, 10, "Padel", 4400, L), t(b, 12, "Mahaana Save+", 27500, S),
      t(b, 15, "Freelance", Math.round(52000 / k), null, "IN"), t(b, 18, "Grocery top-up", Math.round(9000 * k), F), t(b, 20, "Car maintenance", Math.round(6500 * k), T),
      t(b, 22, "Takeaway", Math.round(3200 * k), O), t(b, 25, "Gym", 6000, L), t(b, 27, "Debt paid - Car loan", 15000, D),
    );
  }
  const acc = (id: string, name: string, kind: Account["kind"], balance: number, i: number): Account => ({ id, name, kind, balance, sort_order: i, created_at: i });
  return {
    txns: txns.filter((x) => x.txn_date <= `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`),
    accounts: [
      acc("a1", "Provident Fund", "asset", 850000, 0), acc("a2", "Gold (2 tola)", "asset", 1100000, 1), acc("a3", "Car - Passo", "asset", 2600000, 2),
      acc("b1", "Meezan Bank", "bank", 420000, 0), acc("b2", "HBL", "bank", 135000, 1),
      acc("c1", "Car loan", "debt", 380000, 0), acc("c2", "Ali", "debt", 25000, 1),
    ],
  };
}

export function demoLedger() {
  const D = 86400000, base = Date.now() - 120 * D;
  const iso = (d: number, h = 10) => new Date(base + d * D + h * 3600000).toISOString();
  let s = 0;
  const tx = (o: Record<string, unknown>) => ({ id: `t${s}`, _seq: s++, note: "", ...o });
  return {
    transactions: [
      tx({ type: "DEPOSIT", amount: 5000, date: iso(0) }),
      tx({ type: "BUY", assetId: "crypto:BTC", qty: 0.03, price: 62000, fee: 2, date: iso(1) }),
      tx({ type: "BUY", assetId: "crypto:ETH", qty: 0.6, price: 2450, fee: 1, date: iso(3) }),
      tx({ type: "BUY", assetId: "crypto:SOL", qty: 6, price: 140, fee: 0.5, date: iso(10) }),
      tx({ type: "SELL", assetId: "crypto:SOL", qty: 3, price: 165, fee: 0.5, date: iso(24) }),
      tx({ type: "SELL", assetId: "crypto:SOL", qty: 3, price: 172, fee: 0.5, date: iso(26) }),
      tx({ type: "DEPOSIT", amount: 1500, date: iso(40) }),
      tx({ type: "BUY", assetId: "stock:INTC", qty: 40, price: 21, fee: 1, date: iso(45) }),
      tx({ type: "SELL", assetId: "crypto:ETH", qty: 0.2, price: 2300, fee: 1, date: iso(70) }),
      tx({ type: "BUY", assetId: "crypto:DOGE", qty: 4000, price: 0.12, fee: 0.4, date: iso(90) }),
    ],
    assets: {
      "crypto:BTC": { id: "crypto:BTC", type: "crypto", symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", img: "https://coin-images.coingecko.com/coins/images/1/thumb/bitcoin.png" },
      "crypto:ETH": { id: "crypto:ETH", type: "crypto", symbol: "ETH", name: "Ethereum", coingeckoId: "ethereum", img: "https://coin-images.coingecko.com/coins/images/279/thumb/ethereum.png" },
      "crypto:SOL": { id: "crypto:SOL", type: "crypto", symbol: "SOL", name: "Solana", coingeckoId: "solana", img: "https://coin-images.coingecko.com/coins/images/4128/thumb/solana.png" },
      "crypto:DOGE": { id: "crypto:DOGE", type: "crypto", symbol: "DOGE", name: "Dogecoin", coingeckoId: "dogecoin", img: null },
      "stock:INTC": { id: "stock:INTC", type: "stock", symbol: "INTC", name: "Intel Corp", coingeckoId: null, img: null },
    },
    settings: { finnhubKey: "", autoRefreshSec: 0, secondaryCurrency: "PKR", manualRate: null, owedToOthers: 0 },
    goals: [
      { id: "g1", name: "First 10k", type: "fixed", target: 10000, profitPct: 8 },
      { id: "g2", name: "Step to 50k", type: "stepup", startAmount: 6500, target: 50000, profitPct: 15, steps: [{ target: 15000, profitPct: 15 }, { target: 50000, profitPct: 8 }] },
    ],
    favorites: [
      { id: "crypto:ADA", type: "crypto", symbol: "ADA", name: "Cardano", coingeckoId: "cardano", img: null },
      { id: "stock:NVDA", type: "stock", symbol: "NVDA", name: "NVIDIA Corp", coingeckoId: null, img: null },
    ],
    updatedAt: Date.now(),
  };
}
