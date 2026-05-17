import { MapPin } from "lucide-react";
import type { WeatherData } from "../types/api";

export function WeatherSummaryCard({
  weather,
  metrics,
  className = "",
}: {
  weather: WeatherData | null;
  metrics: { label: string; val: string }[];
  className?: string;
}) {
  return (
    <div
      className={`weather-summary-card glass-card-strong flex w-full items-center justify-between gap-4 rounded-2xl ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <span className="weather-summary-temp font-light tabular-nums leading-none text-stone-800">
            {Math.round(weather?.temp || 0)}°
          </span>
          <span className="truncate text-[15px] font-medium text-stone-500">
            {weather?.condition || "—"}
          </span>
        </div>
        <p className="weather-summary-location mt-1.5 truncate font-medium text-stone-400">
          <MapPin size={11} className="mr-0.5 inline -mt-px" />
          {weather?.locationName || "未知地點"}
        </p>
      </div>
      <div className="weather-summary-metrics grid shrink-0 grid-cols-2 text-right">
        {metrics.map((item) => (
          <div key={item.label} className="leading-tight">
            <div className="text-[11px] font-medium text-stone-400">{item.label}</div>
            <div className="text-[13px] font-semibold tabular-nums text-stone-700">{item.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
