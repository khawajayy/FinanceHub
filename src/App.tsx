import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Backdrop, Logo, Shell } from "@/components/Shell";
import { DialogHost, Toaster } from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { useExpenses } from "@/stores/expenses";
import { useInvest } from "@/stores/invest";
import { usePower } from "@/stores/power";
import { useTasks } from "@/stores/tasks";
import Tasks from "@/modules/tasks/Tasks";
import Login from "@/pages/Login";
import Hub from "@/pages/Hub";
import ExpenseOverview from "@/modules/expenses/Overview";
import ExpenseTransactions from "@/modules/expenses/Transactions";
import NetWorth from "@/modules/expenses/NetWorth";
import { ExpenseTxnModal } from "@/modules/expenses/TxnModal";
import { PFCalculator } from "@/modules/expenses/PFCalculator";
import InvestDashboard from "@/modules/invest/Dashboard";
import Holdings from "@/modules/invest/Holdings";
import Watchlist from "@/modules/invest/Watchlist";
import News from "@/modules/invest/News";
import Ledger from "@/modules/invest/Ledger";
import Goals from "@/modules/invest/Goals";
import InvestSettings from "@/modules/invest/Settings";
import { InvestTxnModal } from "@/modules/invest/TxnModal";
import PowerDashboard from "@/modules/power/Dashboard";
import PowerReadings from "@/modules/power/Readings";
import PowerCycles from "@/modules/power/Cycles";
import PowerAppliances from "@/modules/power/Appliances";

function Boot() {
  return (
    <div className="relative z-10 grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4"><Logo size={56} /><div className="label animate-pulse">Initialising</div></div>
    </div>
  );
}

export default function App() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);

  // Start / stop the Firestore subscriptions with the signed-in user.
  useEffect(() => {
    if (user) { useExpenses.getState().start(user.uid); useInvest.getState().start(user.uid); usePower.getState().start(user.uid); useTasks.getState().start(user.uid); }
    else { useExpenses.getState().stop(); useInvest.getState().stop(); usePower.getState().stop(); useTasks.getState().stop(); }
  }, [user]);

  return (
    <MotionConfig reducedMotion="user">
      <Backdrop />
      {!ready ? <Boot /> : !user ? <Login /> : (
        <HashRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Hub />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="expenses" element={<ExpenseOverview />} />
              <Route path="expenses/transactions" element={<ExpenseTransactions />} />
              <Route path="expenses/networth" element={<NetWorth />} />
              <Route path="invest" element={<InvestDashboard />} />
              <Route path="invest/holdings" element={<Holdings />} />
              <Route path="invest/watchlist" element={<Watchlist />} />
              <Route path="invest/news" element={<News />} />
              <Route path="invest/ledger" element={<Ledger />} />
              <Route path="invest/goals" element={<Goals />} />
              <Route path="invest/settings" element={<InvestSettings />} />
              <Route path="power" element={<PowerDashboard />} />
              <Route path="power/readings" element={<PowerReadings />} />
              <Route path="power/cycles" element={<PowerCycles />} />
              <Route path="power/appliances" element={<PowerAppliances />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <ExpenseTxnModal />
          <InvestTxnModal />
          <PFCalculator />
        </HashRouter>
      )}
      <DialogHost />
      <Toaster />
    </MotionConfig>
  );
}
