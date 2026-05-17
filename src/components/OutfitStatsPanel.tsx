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
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 text-center">
          當前氣候穿搭率最高 (TOP 3)
        </h4>
        {insights && insights.sampleCount > 0 && (
          <p className="text-[9px] text-slate-400 text-center mb-3">
            {insights.tempMin}°–{insights.tempMax}°C・共 {insights.sampleCount} 筆穿搭
          </p>
        )}
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">統計資料載入中…</div>
        ) : !insights || insights.sampleCount === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 leading-relaxed">
            此溫度尚無足夠穿搭資料
            <br />
            完成一筆記錄後就會出現在這裡
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <TagColumn title="上著" items={insights.upperTop3} />
            <TagColumn title="下著" items={insights.lowerTop3} />
          </div>
        )}
      </div>
    </div>
  );
}

function TagColumn({ title, items }: { title: string; items: OutfitTagStat[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest text-center mb-1">
        {title}
      </div>
      {items.map((item, i) => (
        <div key={i} className="bg-slate-50 rounded-xl p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-lg">{item.emoji}</div>
            <div className="text-[10px] font-bold text-slate-700 truncate max-w-[52px]">{item.name}</div>
          </div>
          <div className="text-[9px] font-black text-[#1D9E75]">{item.percent}%</div>
        </div>
      ))}
    </div>
  );
}
