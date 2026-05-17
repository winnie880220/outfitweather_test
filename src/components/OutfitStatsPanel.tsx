import type { OutfitInsights, OutfitTagStat } from "../lib/api";

export function OutfitStatsPanel({
  insights,
  loading,
}: {
  insights: OutfitInsights | null;
  loading: boolean;
}) {
  return (
    <div className="w-full pb-2">
      <div className="stats-panel w-full rounded-3xl p-5">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
          此天氣下
        </p>
        <h2 className="mt-1 text-center text-lg font-bold leading-snug text-stone-800">
          穿搭率最高
        </h2>
        <p className="mt-0.5 text-center text-sm font-bold tracking-wide text-stone-600">
          TOP 3
        </p>
        {insights && insights.sampleCount > 0 && (
          <p className="mt-2 text-center text-xs text-stone-400">
            {insights.tempMin}°–{insights.tempMax}°C・共 {insights.sampleCount} 筆穿搭
          </p>
        )}
        {loading ? (
          <div className="py-12 text-center text-sm text-stone-400 animate-pulse">
            統計資料載入中…
          </div>
        ) : !insights || insights.sampleCount === 0 ? (
          <div className="py-10 text-center text-sm text-stone-400 leading-relaxed">
            此溫度尚無足夠穿搭資料
            <br />
            <span className="text-xs">完成一筆記錄後就會出現在這裡</span>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-5">
            <TagColumn title="上著" items={insights.upperTop3} />
            <TagColumn title="下著" items={insights.lowerTop3} />
          </div>
        )}
      </div>
    </div>
  );
}

function TagColumn({ title, items }: { title: string; items: OutfitTagStat[] }) {
  if (items.length === 0) {
    return (
      <div className="min-w-0 flex flex-col gap-2.5">
        <div className="text-center text-base font-bold text-stone-800">{title}</div>
        <div className="rounded-2xl border border-dashed border-stone-200 py-6 text-center text-xs text-stone-300">
          尚無資料
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex flex-col gap-2.5">
      <div className="text-center text-base font-bold text-stone-800">{title}</div>
      <div className="stats-list overflow-hidden rounded-2xl">
        {items.map((item, i) => (
          <div key={item.name}>
            <StatRow item={item} rank={i + 1} featured={i === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatRow({
  item,
  rank,
  featured,
}: {
  item: OutfitTagStat;
  rank: number;
  featured?: boolean;
}) {
  return (
    <div
      className={
        featured
          ? "flex min-w-0 items-center gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2.5"
          : "flex min-w-0 items-center gap-2 border-t border-stone-100 bg-white px-3 py-2"
      }
    >
      <span
        className={
          featured
            ? "w-5 shrink-0 text-center text-xs font-bold text-stone-700"
            : "w-5 shrink-0 text-center text-[11px] font-bold text-stone-400"
        }
      >
        {rank}
      </span>

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-50 text-base leading-none">
        {item.emoji}
      </div>

      <span
        className={
          featured
            ? "min-w-0 flex-1 basis-0 truncate text-sm font-bold text-stone-800"
            : "min-w-0 flex-1 basis-0 truncate text-sm font-medium text-stone-600"
        }
      >
        {item.name}
      </span>

      <span
        className={
          featured
            ? "shrink-0 text-sm font-bold tabular-nums text-[#5a7d60]"
            : "shrink-0 text-xs font-bold tabular-nums text-[#6b8f71]"
        }
      >
        {item.percent}%
      </span>
    </div>
  );
}
