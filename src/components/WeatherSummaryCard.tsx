import { MapPin } from "lucide-react";
import {
  formatTodayTempRange,
  hasDailyTempRange,
} from "../../lib/weather-display";
import type { WeatherData } from "../types/api";

export function WeatherSummaryCard({
  weather,
  metrics,
  className = "",
  showDailyRange,
  compact = false,
}: {
  weather: WeatherData | null;
  metrics: { label: string; val: string }[];
  className?: string;
  showDailyRange?: boolean;
  /** 記錄頁等較緊湊版面 */
  compact?: boolean;
}) {
  const showRange =
    showDailyRange !== false && hasDailyTempRange(weather);

  return (
    <div
      className={`weather-summary-card glass-card-strong flex w-full items-center justify-between ${
        compact ? "weather-summary-card--compact gap-3 p-3.5" : "gap-4"
      } ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`weather-summary-temp font-light tabular-nums leading-none text-stone-800 ${
              compact ? "text-[1.75rem]" : ""
            }`}
          >
            {Math.round(weather?.temp || 0)}°
          </span>
          <span
            className={`truncate font-medium text-stone-500 ${
              compact ? "text-sm" : "text-[15px]"
            }`}
          >
            {weather?.condition || "—"}
          </span>
        </div>
        {showRange && weather && (
          <p
            className={`weather-summary-daily-range mt-1 font-medium tabular-nums text-stone-500 ${
              compact ? "text-xs" : "text-[13px]"
            }`}
          >
            {formatTodayTempRange(weather)}
          </p>
        )}
        <p
          className={`weather-summary-location truncate font-medium text-stone-400 ${
            compact ? "mt-1 text-xs" : "mt-1.5"
          }`}
        >
          <MapPin size={11} className="mr-0.5 inline -mt-px" />
          {weather?.locationName || "未知地點"}
        </p>
      </div>
      <div
        className={`weather-summary-metrics grid shrink-0 grid-cols-2 text-right ${
          compact ? "gap-x-3 gap-y-2" : ""
        }`}
      >
        {metrics.map((item) => (
          <div key={item.label} className="leading-tight">
            <div className="text-[11px] font-medium text-stone-400">
              {item.label}
            </div>
            <div
              className={`font-semibold tabular-nums text-stone-700 ${
                compact ? "text-xs" : "text-[13px]"
              }`}
            >
              {item.val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
