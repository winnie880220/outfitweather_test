import { feelMetricChips, hasFeelMetrics, type FeelMetrics } from "../lib/feel-metrics";

/** 體感三向度：置於卡片內容區，不疊在照片上 */
export function FeelMetricsChips({
  metrics,
  compact = false,
}: {
  metrics: FeelMetrics;
  compact?: boolean;
}) {
  if (!hasFeelMetrics(metrics)) return null;

  const chips = feelMetricChips(metrics);

  if (compact) {
    return (
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-center shadow-sm backdrop-blur-sm"
            style={{
              borderColor: `${chip.tone}35`,
              backgroundColor: `${chip.tone}14`,
            }}
          >
            <span className="text-[10px] font-bold leading-none" style={{ color: chip.tone }}>
              {chip.label}
            </span>
            <span className="text-sm font-semibold leading-snug text-stone-700">
              {chip.hint}
            </span>
            <span
              className="text-[11px] font-bold tabular-nums leading-none"
              style={{ color: chip.tone }}
            >
              {chip.value}%
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium leading-none backdrop-blur-sm"
          style={{
            borderColor: `${chip.tone}35`,
            backgroundColor: `${chip.tone}14`,
            color: chip.tone,
          }}
        >
          <span className="font-bold">{chip.label}</span>
          <span className="text-stone-600">{chip.hint}</span>
          <span className="tabular-nums opacity-80">{chip.value}%</span>
        </span>
      ))}
    </div>
  );
}
