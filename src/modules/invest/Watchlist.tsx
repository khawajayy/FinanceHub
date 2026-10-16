import { AnimatePresence, motion } from "framer-motion";
import { Newspaper, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AssetType } from "@/engine/ledger-engine.js";
import { Card, CardHeader, Empty, Segmented } from "@/components/ui";
import { fmtPrice } from "@/lib/format";
import { useActions } from "@/stores/actions";
import { useInvest } from "@/stores/invest";
import { toast } from "@/stores/ui";
import { PageTitle } from "@/modules/expenses/common";
import { AssetSearch } from "./AssetSearch";
import { AssetCell, freshness } from "./common";

export default function Watchlist() {
  const favs = useInvest((s) => s.favorites);
  const prices = useInvest((s) => s.prices);
  const mutate = useInvest((s) => s.mutate);
  const refresh = useInvest((s) => s.refreshPrices);
  const openInvest = useActions((s) => s.openInvest);
  const nav = useNavigate();
  const [type, setType] = useState<AssetType>("crypto");

  return (
    <>
      <PageTitle title="Watchlist" sub="Coins and stocks you follow without owning" />
      <Card>
        <CardHeader title="Watching" icon={<Star size={16} />} right={favs.length ? <span className="text-xs text-muted">{freshness(favs.map((f) => prices[f.id]?.updatedAt))}</span> : null} />
        <div className="flex flex-wrap gap-2 border-b hairline p-4">
          <Segmented id="wtype" value={type} onChange={setType} options={[{ value: "crypto", label: "Crypto" }, { value: "stock", label: "Stock" }]} />
          <div className="min-w-[220px] flex-1">
            <AssetSearch key={type} type={type} placeholder="Search to add a ticker or coin…" onPick={(a) => {
              if (favs.some((f) => f.id === a.id)) { toast("Already in watchlist"); return; }
              mutate((d) => { d.favorites.push(a); });
              toast(`Added ${a.symbol}`); setTimeout(() => refresh(), 50);
            }} />
          </div>
        </div>
        {!favs.length ? <Empty icon="⭐" title="Your watchlist is empty" sub="Search above to add stocks or coins you want to keep an eye on." /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {favs.map((f, i) => {
                const live = prices[f.id]?.price;
                return (
                  <motion.div key={f.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.03 }}
                    className="group rounded-2xl bg-line/[.03] p-4 ring-1 ring-line/5 transition hover:ring-cyan/30">
                    <div className="flex items-start">
                      <AssetCell a={f} />
                      <button className="icon-btn ml-auto opacity-50 hover:!text-neg group-hover:opacity-100" title="Remove from watchlist"
                        onClick={() => { mutate((d) => { d.favorites = d.favorites.filter((x) => x.id !== f.id); }); toast("Removed from watchlist"); }}><Trash2 size={15} /></button>
                    </div>
                    <div className="num mt-3 text-2xl font-semibold">{live != null ? fmtPrice(live) : <span className="text-muted">—</span>}</div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn btn-sm btn-primary" onClick={() => openInvest(null, { type: "BUY", asset: f })}><Plus size={13} /> Buy</button>
                      {f.type === "stock" && <button className="btn btn-sm" onClick={() => nav(`/invest/news?t=${encodeURIComponent(f.symbol)}`)}><Newspaper size={13} /> News</button>}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </>
  );
}
