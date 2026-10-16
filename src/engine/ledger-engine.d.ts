export type TxType = "DEPOSIT" | "WITHDRAW" | "BUY" | "SELL" | "ADJUST";
export type AssetType = "crypto" | "stock";

export interface Asset {
  id: string;
  type: AssetType;
  symbol: string;
  name: string;
  coingeckoId: string | null;
  img: string | null;
}

export interface Txn {
  id: string;
  type: TxType;
  date: string;
  note: string;
  _seq?: number;
  amount?: number;
  assetId?: string;
  qty?: number;
  price?: number;
  fee?: number;
  target?: "cash" | "asset";
  delta?: number;
  qtyDelta?: number;
}

export interface PricePoint { price: number; updatedAt: string }
export interface PriceHistory { points: { t: number; p: number }[]; days: number; updatedAt: number }

export interface Goal {
  id: string;
  name: string;
  type: "fixed" | "stepup";
  target: number;
  profitPct: number;
  startAmount: number | null;
  steps: { target: number; profitPct: number }[];
  tradeDays: number | null;
}

export interface InvestSettings {
  finnhubKey: string;
  autoRefreshSec: number;
  secondaryCurrency: string;
  manualRate: number | null;
  owedToOthers: number;
}

export interface Holding {
  assetId: string;
  asset: Asset;
  qty: number;
  avgCost: number;
  costBasis: number;
  live: number | null;
  marketValue: number | null;
  unrealized: number | null;
  updatedAt: string | null;
  breakevenPrice: number | null;
}

export interface Position { qty: number; costBasis: number; lastPrice?: number; lastTime?: number }

export interface Summary {
  cash: number; deposits: number; withdrawals: number; netCapital: number;
  realized: number; feesPaid: number; holdings: Holding[]; holdingsValue: number; holdingsCost: number;
  unrealized: number; equity: number; totalReturn: number; totalReturnPct: number;
  positions: Record<string, Position>;
}

export interface Range { isAll: boolean; startTs: number; endTs: number }

export interface SellItem {
  txn: Txn; realized: number; basisSold: number; cashImpact: number; qty: number; price: number; fee: number;
  date: string; matchedQty: number; weightedDurMs: number; holdingTimeMs: number;
}
export interface SellGroup {
  id: string; assetId: string; symbol: string; items: SellItem[];
  totalQty: number; totalGross: number; totalFees: number; totalCashImpact: number; totalCostBasis: number;
  collectiveRealized: number; collectiveReturnPct: number; avgPrice: number;
  earliestDate: string; latestDate: string; isCombined: boolean;
  hasHoldingTime: boolean; holdingTimeMs: number; holdingTimeDays: number;
}
export interface Analytics {
  totalClosedTrades: number; winTrades: number; winAmount: number; lossTrades: number; lossAmount: number;
  beTrades: number; netRealized: number; winRatePct: number; profitFactor: number | null;
  avgWin: number; avgLoss: number; winLossRatio: number | null; expectancy: number; avgReturnPct: number;
  totalVolume: number; totalFees: number; bestTrade: SellGroup | null; worstTrade: SellGroup | null;
  avgHoldingTimeProfitableMs: number | null; avgHoldingTimeProfitableDays: number | null;
  avgHoldingTimeAllMs: number | null; avgHoldingTimeAllDays: number | null;
}

export interface ValuationCtx {
  transactions: Txn[];
  prices: Record<string, PricePoint>;
  priceHistory: Record<string, PriceHistory>;
  now: number;
}
export interface SeriesPoint { t: number; v: number; nc: number; profit: number; retPct: number }
export interface RangeStats {
  depositsP: number; withdrawalsP: number; netInvestedP: number; realizedP: number; feesP: number;
  buysP: number; sellsP: number; equityStart: number; equityEnd: number; periodReturn: number;
  periodReturnPct: number; approx: boolean;
}

interface LedgerEngineApi {
  EPS: number;
  TX_TYPES: TxType[];
  makeId(): string;
  safeUrl(u: unknown): string;
  isSafeId(v: unknown): boolean;
  sanitizeAsset(a: unknown): Asset | null;
  sanitizeTransaction(t: unknown, index: number): Txn | null;
  sanitizeTransactions(list: unknown): { transactions: Txn[]; dropped: number };
  sanitizeAssets(obj: unknown): Record<string, Asset>;
  sanitizeFavorites(list: unknown): Asset[];
  sanitizeSettings(s: unknown, defaults: InvestSettings): InvestSettings;
  sanitizeGoals(list: unknown, legacyGoal?: unknown): Goal[];
  sanitizePrices(obj: unknown): Record<string, PricePoint>;
  sanitizePriceHistory(obj: unknown): Record<string, PriceHistory>;
  sanitizeEquityHistory(list: unknown): { t: number; v: number }[];
  sortChrono(txns: Txn[]): Txn[];
  replay(txns: Txn[], onTxn?: (t: Txn, realized: number, book: unknown) => void): unknown;
  summarize(state: { transactions: Txn[]; assets: Record<string, Asset>; prices: Record<string, PricePoint> }, excludeId?: string | null): Summary;
  realizedBySell(txns: Txn[]): Record<string, number>;
  computeClosedTradesAndAnalytics(txns: Txn[], range: Range | null, assets: Record<string, Asset>): {
    realizedByTxn: Record<string, number>; basisByTxn: Record<string, number>; holdingMsByTxn: Record<string, number>;
    allSellGroups: SellGroup[]; inRangeGroups: SellGroup[]; sellGroupsMap: Record<string, SellGroup>; analytics: Analytics;
  };
  equitySeries(ctx: ValuationCtx, range: Range, filter: string, currentEquity: number | null, equityHistory: { t: number; v: number }[]): SeriesPoint[];
  rangeStats(ctx: ValuationCtx, range: Range): RangeStats;
}

declare const LedgerEngine: LedgerEngineApi;
export default LedgerEngine;
