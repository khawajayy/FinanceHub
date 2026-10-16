export interface StepSummary {
  stepNumber: number; startingBalance: number; targetAmount: number; profitPct: number;
  tradesCount: number; endingBalance: number; profitGenerated: number;
}
export interface TradeRow {
  trade: number; step: number | null; profitPct: number | null; startingBalance: number | null;
  profit: number | null; endingBalance: number; isStepStart: boolean;
}
export interface StepUpResult {
  valid: boolean; error?: string; hitLimit?: boolean; totalTrades: number; initialStartingBalance: number;
  finalBalance: number; totalProfit: number; goalAmount: number; overshootAmount: number;
  steps: StepSummary[]; trades: TradeRow[];
}
interface GoalCalcApi {
  roundCurrency(n: number): number;
  tradesToGoal(from: number, to: number, pct: number): number | null;
  validateStepUpGoal(p: { startAmount: number; steps: { target: number; profitPct: number }[] }): { valid: boolean; error?: string };
  calculateStepUpGoal(p: { startAmount: number; steps: { target: number; profitPct: number }[] }): StepUpResult;
  estimateTimeToGoal(totalTrades: number, daysPerTrade: number): { totalDays: number; formatted: string };
  MAX_TRADES: number;
}
declare const GoalCalc: GoalCalcApi;
export default GoalCalc;
