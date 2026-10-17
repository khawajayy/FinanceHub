# Nexus — Personal Hub

One personal hub: tasks and long-term goals, plus an app that combines **[ExpenseTracker](https://github.com/khawajayy/ExpenseTracker)**, **[CryptoTracker](https://github.com/khawajayy/CryptoTracker)** and **[ElectricityGuru](https://github.com/khawajayy/ElectricityGuru)**, rebuilt with React, Vite and TypeScript and an animated glass UI.

| Area | What's inside |
|---|---|
| **Hub** | Lesson of the day (an animated daily idea — patience, delayed gratification, focus… — with a public-domain quote, a modern take and one small practice you can mark done or add to today's tasks; changes at midnight, browse the past week), Today's focus (urgent tasks, quick add, progress ring, streak), active goals (at-risk first), total net worth in PKR (net-worth register + investments at the live USD/PKR rate, less money owed), this month's cash flow, portfolio snapshot, next goal, and recent activity across both modules |
| **Tasks** | Natural-language quick add (`Pay rent tomorrow !high #finance` → due date, priority, list), Focus / Upcoming / All / Done views, smart buckets (overdue, today, tomorrow, next 7 days, later, someday), lists, subtasks, notes, undo, 7-day completion chart and streak; sidebar badge for tasks due |
| **Goals** | Long-term goals across six life areas with a "why", target date and milestones; progress from milestones + linked tasks, a tracked number (e.g. km, kg, books, with a log chart), or live net worth / portfolio equity; pace vs. the target date (ahead / on track / at risk / overdue), weekly rate needed, life-wheel radar, pause / drop / achieve. Tasks can link to a goal |
| **Expenses** | Monthly income/expenses/net, savings rate, category donut, 6-month flow chart, searchable transactions with CSV export, net worth (assets, banks, debts with Repay/Borrow), `Debt - Name` / `Debt paid - Name` auto-debts, Provident Fund calculator |
| **Investments** | Crypto + stock ledger (deposit/withdraw/buy/sell/adjust), live prices (Binance → CoinGecko, Finnhub for stocks), P&L against original capital, equity/profit/return chart with a profit-loss band, holdings with break-even, watchlist, news, trade analytics with combined partial sells, fixed and step-up goals, JSON backup |
| **Electricity** | Meter readings with per-day usage, current billing cycle with projected units and bill, daily-consumption and meter charts, closed cycles saved with the actual bill and estimate accuracy, appliance energy estimator, JSON import of an Electricity Guru backup |

The accounting engine (`src/engine/ledger-engine.js`) and goal maths (`src/engine/goal-calc.js`) are ported line for line from CryptoTracker, and its original unit tests still run against them.

## Data & sign-in

Everything runs on the **existing Firebase project** (`investmenttracker-b544e`) with Google sign-in:

- `ledgers/{uid}` holds the investment ledger. It is **the same document the old CryptoLedger wrote**, so signing in with the same Google account brings your portfolio over unchanged, and the old app keeps working alongside.
- `expenses/{uid}/transactions/*` and `expenses/{uid}/accounts/*` hold expenses and net worth. These start empty.
- `tasks/{uid}/items/*` holds to-dos (title, notes, priority, due date, list, subtasks, optional goal link).
- `goals/{uid}/items/*` holds long-term goals (area, why, dates, metric, milestones, value log).
- `power/{uid}` (tariff, billing day, unit label) and `power/{uid}/readings|appliances|cycles/*` hold electricity data. These start empty; to bring old data over, use **Export JSON** in the original Electricity Guru app, then **Readings → Import** here (readings and appliances).
- Prices, chart history and view preferences are cached per device in localStorage.
- Firestore's offline cache means the app keeps working without a connection and syncs when you're back online.

## One-time setup

1. **Deploy the new security rules**, which add the `expenses/`, `power/`, `tasks/` and `goals/` paths. Until you do this, writes to those are rejected:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules
   ```
2. **Authorize the GitHub Pages domain** for Google sign-in: Firebase Console → Authentication → Settings → Authorized domains → add `khawajayy.github.io`. (`localhost` is allowed by default.)
3. **Create the repo and push:** create an empty GitHub repo named `FinanceHub`, then:
   ```bash
   git remote add origin https://github.com/khawajayy/FinanceHub.git
   git push -u origin main
   ```
4. **Enable Pages:** repo → Settings → Pages → Source: **GitHub Actions**. Every push to `main` runs the tests, builds, and deploys to `https://khawajayy.github.io/FinanceHub/`.

If you name the repo something else, nothing needs changing: the workflow sets the base path from the repo name. For local builds, set `VITE_BASE=/<repo>/`.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/FinanceHub/
npm test           # unit tests (ledger engine, goal maths, expense logic)
npm run build      # typecheck + production build into dist/
```

**Demo mode (dev only):** open `http://localhost:5173/FinanceHub/?demo` to explore every screen with sample data. You don't need to sign in, and nothing is read from or written to Firebase. It's compiled out of production builds.

## Layout

```
src/
  engine/        pure logic + tests target: ledger-engine.js, goal-calc.js, expense-engine.ts, power-engine.ts, task-engine.ts, goal-engine.ts, lessons.ts
  lib/           firebase init, market data (prices/FX/search/news), formatting, demo data
  stores/        zustand stores: auth, expenses (Firestore), invest (Firestore + local), ui, actions
  components/    Shell (nav/backdrop), ui kit (cards, modals, animated numbers), charts
  modules/
    expenses/    Spending overview, Transactions, Net Worth, transaction modal, PF calculator
    invest/      Portfolio, Holdings, Watchlist, News, Ledger, Goals, Settings, trade modal
    lessons/     Daily lesson card for the Hub
    goals/       Goals page, goal create/detail modal, life wheel, Hub card
    tasks/       Tasks page, task row + inline editor, quick add, Hub card
    power/       Electricity usage dashboard, Readings, Billing cycles, Appliances, Hub card
  pages/         Hub, Login
firestore.rules  security rules for both modules
```

## Notes

- Combined net worth adds your investment equity to the net-worth register. If you also list a brokerage balance as an asset under Net Worth, it gets counted twice; keep investments in one place.
- The Finnhub key is stored in your own ledger document and sent as a query parameter to finnhub.io, which is how Finnhub's API works.
