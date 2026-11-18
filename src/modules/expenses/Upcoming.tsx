import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Empty, Segmented, Stat } from "@/components/ui";
import {
  categoryColor,
  categoryEmoji,
  filterUpcoming,
  targetDateLabel,
  todayISO,
  type Bucket,
  type UpcomingExpense,
} from "@/engine/expense-engine";
import { cx, fmtRs } from "@/lib/format";
import { useExpenses } from "@/stores/expenses";
import { confirmDialog, toast } from "@/stores/ui";
import { LoadingGrid, PageTitle } from "./common";
import { UpcomingModal } from "./UpcomingModal";

const PRI_STYLE: Record<string, { text: string; bg: string; label: string }> = {
  high: { text: "text-pink", bg: "bg-pink/15 ring-pink/30", label: "Essential" },
  med: { text: "text-cyan", bg: "bg-cyan/15 ring-cyan/30", label: "Planned" },
  low: { text: "text-muted", bg: "bg-line/10 ring-line/15", label: "Wishlist" },
};

function UpcomingRow({
  item,
  bucket,
  onEdit,
  onConvert,
  onDelete,
}: {
  item: UpcomingExpense;
  bucket?: Bucket;
  onEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
}) {
  const categories = useExpenses((s) => s.categories);
  const today = todayISO();
  const dateLabel = targetDateLabel(item.date, today);
  const isConverted = item.status === "converted";
  const pStyle = PRI_STYLE[item.priority] || PRI_STYLE.med;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cx(
        "group flex flex-col gap-2 border-b border-line/5 p-4 transition-colors last:border-none sm:flex-row sm:items-center sm:gap-4",
        isConverted && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg shadow-sm"
          style={{
            background: `${categoryColor(item.category, categories)}22`,
            boxShadow: `inset 0 0 0 1px ${categoryColor(item.category, categories)}44`,
          }}
        >
          {categoryEmoji(item.category, categories)}
        </span>
        <div className="min-w-0 flex-1 sm:hidden">
          <div className="truncate font-medium">{item.title}</div>
          <div className="num text-base font-semibold text-ink">{fmtRs(item.amount)}</div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink">{item.title}</span>
            {isConverted && (
              <span className="chip !py-0.5 !text-[10px] !bg-pos/15 !text-pos">
                <Check size={10} /> Logged in expenses
              </span>
            )}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <span className={cx("chip !normal-case !py-0.5 !text-[10.5px] font-semibold ring-1", pStyle.bg, pStyle.text)}>
            {pStyle.label}
          </span>
          {item.date && (
            <span className="inline-flex items-center gap-1 font-medium text-amber">
              <CalendarDays size={11} /> {dateLabel}
            </span>
          )}
          {!item.date && (
            <span className="inline-flex items-center gap-1 text-muted">
              <CalendarClock size={11} /> Flexible
            </span>
          )}
          {bucket && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium" style={{ background: `${bucket.color}22`, color: bucket.color }}>
              <span>{bucket.emoji}</span>
              <span className="truncate max-w-[120px]">{bucket.name}</span>
            </span>
          )}
          {item.notes && <span className="truncate max-w-[260px] text-muted">· {item.notes}</span>}
        </div>
      </div>

      <div className="hidden text-right sm:block">
        <div className="num text-lg font-semibold text-ink">{fmtRs(item.amount)}</div>
        <div className="text-[11px] text-muted">{item.category || "Uncategorised"}</div>
      </div>

      <div className="flex items-center justify-end gap-1 pt-1 sm:pt-0">
        {!isConverted && (
          <button
            type="button"
            onClick={onConvert}
            className="btn btn-primary btn-sm !py-1.5 !px-3 !text-xs inline-flex items-center gap-1.5"
            title="Log this expense into your actual transactions now"
          >
            <Wallet size={13} />
            <span>Log as Expense</span>
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="icon-btn"
          aria-label="Edit planned expense"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="icon-btn hover:!text-neg"
          aria-label="Delete planned expense"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}

export default function UpcomingExpenses() {
  const loaded = useExpenses((s) => s.loaded);
  const upcoming = useExpenses((s) => s.upcoming);
  const buckets = useExpenses((s) => s.buckets);
  const convert = useExpenses((s) => s.convertUpcomingToExpense);
  const undoConvert = useExpenses((s) => s.undoConvertUpcoming);
  const remove = useExpenses((s) => s.deleteUpcoming);

  const [modal, setModal] = useState<{ open: boolean; item: UpcomingExpense | null; bucketId?: string }>({ open: false, item: null });
  const [statusFilter, setStatusFilter] = useState<"planned" | "converted" | "all">("planned");
  const [bucketFilter, setBucketFilter] = useState<string>("");
  const [q, setQ] = useState("");

  const activeBuckets = useMemo(() => buckets.filter((b) => b.status === "active"), [buckets]);
  const bucketMap = useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets]);

  // Summaries
  const allPlanned = useMemo(() => upcoming.filter((x) => x.status === "planned"), [upcoming]);
  const plannedTotal = useMemo(() => allPlanned.reduce((sum, x) => sum + (Number(x.amount) || 0), 0), [allPlanned]);
  const bucketedPlanned = useMemo(() => allPlanned.filter((x) => !!x.bucket), [allPlanned]);
  const bucketedTotal = useMemo(() => bucketedPlanned.reduce((sum, x) => sum + (Number(x.amount) || 0), 0), [bucketedPlanned]);
  const generalPlanned = useMemo(() => allPlanned.filter((x) => !x.bucket), [allPlanned]);
  const generalTotal = useMemo(() => generalPlanned.reduce((sum, x) => sum + (Number(x.amount) || 0), 0), [generalPlanned]);

  // Filtered list
  const filtered = useMemo(() => filterUpcoming(upcoming, q, bucketFilter, statusFilter), [upcoming, q, bucketFilter, statusFilter]);

  // Grouped by bucket
  const groups = useMemo(() => {
    const map = new Map<string, UpcomingExpense[]>();
    for (const item of filtered) {
      const key = item.bucket || "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filtered]);

  const handleConvert = async (item: UpcomingExpense) => {
    const txnId = await convert(item.id);
    toast(`Logged "${item.title}" (${fmtRs(item.amount)}) to expenses`, false, {
      label: "Undo",
      onClick: () => undoConvert(item.id, txnId),
    });
  };

  const handleDelete = async (item: UpcomingExpense) => {
    if (!(await confirmDialog("Delete planned expense", `Remove "${item.title}" from your planned expenses?`, { confirmText: "Delete", danger: true }))) return;
    await remove(item.id);
    toast(`Deleted "${item.title}"`);
  };

  return (
    <>
      <PageTitle
        title="Upcoming Expenses"
        sub="Future purchases & spending to think about — kept out of your actual expenses until incurred"
        right={
          <button
            className="btn btn-primary"
            onClick={() => setModal({ open: true, item: null, bucketId: bucketFilter && bucketFilter !== "__none__" ? bucketFilter : undefined })}
          >
            <Plus size={15} /> Plan expense
          </button>
        }
      />

      {!loaded ? (
        <LoadingGrid />
      ) : (
        <div className="space-y-5">
          {/* Top Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Total Planned"
              icon={<CalendarClock size={15} />}
              value={plannedTotal}
              format={fmtRs}
              tone=""
              glow="cyan"
              delay={0}
              sub={`${allPlanned.length} upcoming expense${allPlanned.length === 1 ? "" : "s"} planned`}
            />
            <Stat
              label="In Buckets"
              icon={<ShoppingBag size={15} />}
              value={bucketedTotal}
              format={fmtRs}
              tone="pos"
              delay={0.05}
              sub={`${bucketedPlanned.length} item${bucketedPlanned.length === 1 ? "" : "s"} grouped in trips & projects`}
            />
            <Stat
              label="To Think About"
              icon={<Sparkles size={15} />}
              value={generalTotal}
              format={fmtRs}
              tone="text-amber"
              delay={0.1}
              sub={`${generalPlanned.length} standalone item${generalPlanned.length === 1 ? "" : "s"} / wishlist`}
            />
          </div>

          {/* Controls & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              id="upcoming-status-filter"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "planned" | "converted" | "all")}
              options={[
                { value: "planned", label: `Planned (${allPlanned.length})` },
                { value: "converted", label: "Logged" },
                { value: "all", label: "All" },
              ]}
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setBucketFilter("")}
                className={cx("chip !normal-case !text-[11px] transition", !bucketFilter && "!bg-line/15 !text-ink")}
              >
                All buckets
              </button>
              <button
                onClick={() => setBucketFilter("__none__")}
                className={cx("chip !normal-case !text-[11px] transition", bucketFilter === "__none__" && "!bg-line/15 !text-ink")}
              >
                💭 General only
              </button>
              {activeBuckets.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBucketFilter(b.id)}
                  className={cx(
                    "chip !normal-case !text-[11px] inline-flex items-center gap-1 transition",
                    bucketFilter === b.id && "!bg-line/20 !text-ink ring-1"
                  )}
                  style={{
                    borderColor: bucketFilter === b.id ? b.color : undefined,
                    boxShadow: bucketFilter === b.id ? `0 0 10px ${b.color}33` : undefined,
                  }}
                >
                  <span>{b.emoji}</span>
                  <span>{b.name}</span>
                </button>
              ))}
            </div>

            <div className="relative ml-auto min-w-[160px] flex-1 sm:max-w-[240px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="input !py-2 !pl-9 text-xs"
                placeholder="Search planned expenses…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search planned expenses"
              />
            </div>
          </div>

          {/* Planned Items Content */}
          {filtered.length === 0 ? (
            <Card>
              <Empty
                icon="💭"
                title={statusFilter === "converted" ? "No logged expenses yet" : "No planned expenses found"}
                sub={
                  statusFilter === "converted"
                    ? "When you mark planned expenses as incurred, they'll show up here."
                    : "Add upcoming expenses or wishlist items you are considering. Group them with a bucket or keep them standalone."
                }
                action={
                  <button
                    className="btn btn-primary"
                    onClick={() => setModal({ open: true, item: null, bucketId: bucketFilter && bucketFilter !== "__none__" ? bucketFilter : undefined })}
                  >
                    <Plus size={15} /> Plan an expense
                  </button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Grouped by Bucket */}
              {Array.from(groups.entries()).map(([key, items]) => {
                const b = key !== "__none__" ? bucketMap.get(key) : undefined;
                const groupTotal = items
                  .filter((x) => x.status === "planned")
                  .reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

                return (
                  <Card key={key}>
                    <div className="flex items-center justify-between border-b border-line/10 bg-line/[.02] px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{b ? b.emoji : "💭"}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold text-ink">
                              {b ? b.name : "General / To Think About"}
                            </span>
                            {b && (
                              <Link
                                to="/expenses/buckets"
                                className="text-[11px] text-muted hover:text-cyan inline-flex items-center gap-0.5"
                                title="View bucket details"
                              >
                                Bucket <ChevronRight size={11} />
                              </Link>
                            )}
                          </div>
                          <div className="text-[11px] text-muted">
                            {items.length} item{items.length === 1 ? "" : "s"} · Planned total:{" "}
                            <span className="font-semibold text-ink">{fmtRs(groupTotal)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn btn-sm btn-ghost inline-flex items-center gap-1 !text-xs"
                        onClick={() => setModal({ open: true, item: null, bucketId: b?.id })}
                      >
                        <Plus size={12} /> Add here
                      </button>
                    </div>

                    <div className="divide-y divide-line/5">
                      <AnimatePresence initial={false}>
                        {items.map((item) => (
                          <UpcomingRow
                            key={item.id}
                            item={item}
                            bucket={b}
                            onEdit={() => setModal({ open: true, item, bucketId: b?.id })}
                            onConvert={() => handleConvert(item)}
                            onDelete={() => handleDelete(item)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl border border-line/10 bg-line/[.02] p-4 text-xs text-muted">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-cyan" />
              <span>
                Planned expenses stay in this planner and <b>never count in your monthly spending totals or bank accounts</b> until you click &ldquo;Log as Expense&rdquo;.
              </span>
            </div>
            <Link to="/expenses/buckets" className="font-semibold text-cyan hover:underline shrink-0 ml-4">
              Manage Buckets →
            </Link>
          </div>
        </div>
      )}

      <UpcomingModal
        open={modal.open}
        upcoming={modal.item}
        initialBucketId={modal.bucketId}
        onClose={() => setModal({ open: false, item: null })}
      />
    </>
  );
}
