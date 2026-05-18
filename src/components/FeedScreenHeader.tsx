import { LogOut } from "lucide-react";
import type { OutfitInsights } from "../lib/api/outfit-insights";
import type { WeatherData } from "../types/api";

function AppExitButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="app-exit-btn" aria-label="離開並返回初始頁">
      <LogOut size={12} strokeWidth={2} />
      離開
    </button>
  );
}

export function FeedScreenHeader({
  title,
  weather,
  insights,
  onRequestExit,
}: {
  title: string;
  weather: WeatherData | null;
  insights: OutfitInsights | null;
  onRequestExit: () => void;
}) {
  const tempLabel = insights
    ? `${insights.tempMin}–${insights.tempMax}°C`
    : `${Math.round(weather?.temp ?? 26)}°`;

  return (
    <header className="inspiration-header inspiration-feed-header flex shrink-0 items-center justify-between gap-2 px-6">
      <span className="font-semibold text-stone-800">{title}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="glass-pill rounded-full px-2.5 py-1 text-[11px] font-medium text-stone-600">
          {tempLabel} 相似天氣
        </span>
        <AppExitButton onClick={onRequestExit} />
      </div>
    </header>
  );
}
