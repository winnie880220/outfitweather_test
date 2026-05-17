import type { OutfitInsights, OutfitTagStat } from "../lib/api";

export function OutfitStatsPanel({
  insights,
  loading,
}: {
  insights: OutfitInsights | null;
  loading: boolean;
}) {
  return (
    <div className="px-4 mb-6">
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h4 className="text-xs text-slate-500 font-semibold text-center mb-1">
          當前氣候穿搭率最高
        </h4>
        <p className="text-[11px] text-[#378ADD] font-medium text-center mb-4">TOP 3</p>
        {insights && insights.sampleCount > 0 && (
          <p className="text-xs text-slate-400 text-center mb-4 -mt-2">
            {insights.tempMin}°–{insights.tempMax}°C・共 {insights.sampleCount} 筆穿搭
          </p>
        )}
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400 animate-pulse">統計資料載入中…</div>
        ) : !insights || insights.sampleCount === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 leading-relaxed">
            此溫度尚無足夠穿搭資料
            <br />
            <span className="text-xs">完成一筆記錄後就會出現在這裡</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <TagColumn title="上著" items={insights.upperTop3} />
            <TagColumn title="下著" items={insights.lowerTop3} />
          </div>
        )}
      </div>
    </div>
  );
}

function TagColumn({ title, items }: { title: string; items: OutfitTagStat[] }) {
  const [first, ...rest] = items;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold text-[#185FA5] text-center">{title}</div>
      {first ? <Top1Row item={first} rank={1} /> : null}
      <div className="space-y-1.5">
        {rest.map((item, i) => (
          <div key={item.name}>
            <TopSubRow item={item} rank={i + 2} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Top1Row({ item, rank }: { item: OutfitTagStat; rank: number }) {
  return (
    <div className="bg-[#E6F1FB] border border-[#B5D4F4] rounded-2xl p-4 flex items-center gap-3">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white flex items-center justify-center text-3xl shadow-sm">
        {item.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[11px] font-bold text-[#378ADD] bg-white px-2 py-0.5 rounded-md">
            TOP {rank}
          </span>
        </div>
        <div className="text-base font-bold text-[#0C447C] truncate leading-snug">{item.name}</div>
      </div>
      <div className="text-2xl font-bold text-[#1D9E75] tabular-nums">{item.percent}%</div>
    </div>
  );
}

function TopSubRow({ item, rank }: { item: OutfitTagStat; rank: number }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
      <span className="text-[11px] font-bold text-slate-400 w-7">#{rank}</span>
      <span className="text-lg leading-none">{item.emoji}</span>
      <span className="flex-1 text-sm font-medium text-slate-700 truncate">{item.name}</span>
      <span className="text-sm font-bold text-[#1D9E75] tabular-nums">{item.percent}%</span>
    </div>
  );
}
