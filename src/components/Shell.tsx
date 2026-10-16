import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutGrid, Wallet, ReceiptText, Landmark, LineChart, Briefcase, Star, Newspaper, BookOpen, Target, Settings2,
  Sun, Moon, LogOut, RefreshCw, Cloud, CloudOff, Plus,
} from "lucide-react";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { useInvest } from "@/stores/invest";
import { useUi } from "@/stores/ui";
import { useActions } from "@/stores/actions";
import { cx } from "@/lib/format";
import { useEffect, useId, type ReactNode } from "react";

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="grid-lines" /><div className="noise" />
    </div>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  const gid = "lg" + useId().replace(/:/g, "");
  return (
    <div className="relative grid place-items-center rounded-xl bg-bg ring-1 ring-line/10" style={{ width: size, height: size }}>
      <div className="spin-slow absolute inset-[-2px] rounded-xl bg-[conic-gradient(from_0deg,rgb(var(--cyan)),rgb(var(--violet)),rgb(var(--pink)),rgb(var(--cyan)))] opacity-70 blur-[6px]" />
      <div className="absolute inset-0 rounded-xl bg-bg" />
      <svg viewBox="0 0 64 64" width={size * 0.62} height={size * 0.62} className="relative">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgb(var(--cyan))" /><stop offset="1" stopColor="rgb(var(--violet))" /></linearGradient></defs>
        <path d="M14 50V14l36 36V14" stroke={`url(#${gid})`} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const NAV: { group: string; items: { to: string; label: string; icon: ReactNode; end?: boolean }[] }[] = [
  { group: "Overview", items: [{ to: "/", label: "Hub", icon: <LayoutGrid size={18} />, end: true }] },
  {
    group: "Expenses", items: [
      { to: "/expenses", label: "Spending", icon: <Wallet size={18} />, end: true },
      { to: "/expenses/transactions", label: "Transactions", icon: <ReceiptText size={18} /> },
      { to: "/expenses/networth", label: "Net Worth", icon: <Landmark size={18} /> },
    ],
  },
  {
    group: "Investments", items: [
      { to: "/invest", label: "Portfolio", icon: <LineChart size={18} />, end: true },
      { to: "/invest/holdings", label: "Holdings", icon: <Briefcase size={18} /> },
      { to: "/invest/watchlist", label: "Watchlist", icon: <Star size={18} /> },
      { to: "/invest/news", label: "News", icon: <Newspaper size={18} /> },
      { to: "/invest/ledger", label: "Ledger", icon: <BookOpen size={18} /> },
      { to: "/invest/goals", label: "Goals", icon: <Target size={18} /> },
      { to: "/invest/settings", label: "Settings", icon: <Settings2 size={18} /> },
    ],
  },
];

function SideNav() {
  return (
    <aside className="glass sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col rounded-3xl p-4 lg:flex">
      <div className="mb-6 flex items-center gap-3 px-2 pt-1">
        <Logo />
        <div>
          <div className="font-display text-lg font-bold leading-none tracking-tight">Nexus</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Finance OS</div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="label mb-1.5 px-3 !text-[10px]">{g.group}</div>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end}
                  className={({ isActive }) => cx("group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors", isActive ? "text-ink" : "text-muted hover:text-ink")}>
                  {({ isActive }) => <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan/15 to-violet/10 ring-1 ring-cyan/25" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                    {isActive && <motion.span layoutId="nav-bar" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-cyan shadow-[0_0_12px_rgb(var(--cyan))]" />}
                    <span className={cx("relative transition-transform group-hover:scale-110", isActive && "text-cyan")}>{it.icon}</span>
                    <span className="relative">{it.label}</span>
                  </>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

const MOBILE = [
  { to: "/", label: "Hub", icon: <LayoutGrid size={20} />, match: (p: string) => p === "/" },
  { to: "/expenses", label: "Spend", icon: <Wallet size={20} />, match: (p: string) => p === "/expenses" },
  { to: "/expenses/transactions", label: "Txns", icon: <ReceiptText size={20} />, match: (p: string) => p.startsWith("/expenses/") },
  { to: "/invest", label: "Invest", icon: <LineChart size={20} />, match: (p: string) => p.startsWith("/invest") },
];

function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav className="glass-strong fixed inset-x-3 bottom-3 z-40 flex rounded-2xl p-1.5 shadow-2xl lg:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
      {MOBILE.map((it) => {
        const active = it.match(pathname);
        return (
          <NavLink key={it.to} to={it.to} className={cx("relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10.5px] font-semibold", active ? "text-ink" : "text-muted")}>
            {active && <motion.span layoutId="mnav" className="absolute inset-0 rounded-xl bg-gradient-to-b from-cyan/20 to-violet/10 ring-1 ring-cyan/25" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className={cx("relative", active && "text-cyan")}>{it.icon}</span>
            <span className="relative">{it.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/** Sub-navigation for the investments section on small screens. */
function InvestTabs() {
  const items = NAV[2].items;
  return (
    <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cx("chip !normal-case !text-xs !px-3 !py-1.5 !tracking-normal shrink-0", isActive && "!bg-cyan/15 !text-cyan ring-1 ring-cyan/30")}>
          {it.label}
        </NavLink>
      ))}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night";
}

function TopBar() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const { pathname } = useLocation();
  const inInvest = pathname.startsWith("/invest");
  const cloud = useInvest((s) => s.cloudStatus);
  const priceStatus = useInvest((s) => s.priceStatus);
  const refreshingP = useInvest((s) => s.refreshing);
  const refresh = useInvest((s) => s.refreshPrices);
  const openExpense = useActions((s) => s.openExpense);
  const openInvest = useActions((s) => s.openInvest);
  const first = (user?.displayName || "").split(" ")[0];
  return (
    <header className="mb-5 flex items-center gap-3">
      <div className="flex items-center gap-3 lg:hidden"><Logo size={32} /></div>
      <div className="min-w-0 flex-1">
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="truncate font-display text-lg font-semibold tracking-tight sm:text-2xl">
          {greeting()}{first ? <>, <span className="gradient-text">{first}</span></> : ""}
        </motion.div>
        <div className="flex items-center gap-2 truncate text-xs text-muted">
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          <span className="hidden items-center gap-1 sm:inline-flex">
            · {cloud === "sync error" ? <CloudOff size={12} className="text-neg" /> : <Cloud size={12} className="text-cyan" />} {cloud || "offline"}
          </span>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {inInvest && (
          <button className="btn hidden sm:inline-flex" onClick={() => refresh()} title={`Prices: ${priceStatus}`}>
            <RefreshCw size={15} className={cx(refreshingP && "animate-spin")} /> <span className="hidden md:inline">{refreshingP ? "Updating…" : "Prices"}</span>
          </button>
        )}
        <button className="btn btn-primary" onClick={() => (inInvest ? openInvest() : openExpense())}>
          <Plus size={16} /> <span className="hidden sm:inline">{inInvest ? "Trade" : "Transaction"}</span>
        </button>
        <button className="icon-btn !h-9 !w-9 glass" onClick={toggleTheme} aria-label="Toggle theme">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </motion.span>
          </AnimatePresence>
        </button>
        <div className="group relative">
          {user?.photoURL
            ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-xl ring-1 ring-line/15" />
            : <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan to-violet font-bold text-bg">{(user?.email || "?")[0].toUpperCase()}</div>}
          <div className="invisible absolute right-0 top-11 z-50 w-56 translate-y-1 opacity-0 transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
            <div className="glass-strong rounded-2xl p-2 shadow-2xl">
              <div className="truncate px-3 py-2 text-xs text-muted">{user?.email}</div>
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-line/10" onClick={signOut}><LogOut size={15} /> Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Shell() {
  const location = useLocation();
  const outlet = useOutlet();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);
  return (
    <div className="relative z-10 mx-auto flex max-w-[1500px] gap-5 px-4 pb-28 pt-4 sm:px-5 lg:pb-8">
      <SideNav />
      <main className="min-w-0 flex-1 lg:pt-2">
        <TopBar />
        {location.pathname.startsWith("/invest") && <InvestTabs />}
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
      <MobileNav />
    </div>
  );
}
