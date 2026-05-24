import type { WeatherData } from "../src/types/api";

export type WeatherMetricItem = { label: string; val: string };

/** 記錄頁天氣卡右側指標（含 UV） */
export function buildRecordWeatherMetrics(weather: WeatherData | null): WeatherMetricItem[] {
  return [
    { label: "濕度", val: `${Math.round(weather?.humidity ?? 0)}%` },
    { label: "降雨", val: `${weather?.rainProb ?? 0}%` },
    { label: "體感", val: `${Math.round(weather?.apparentTemp ?? 0)}°` },
    { label: "UV", val: `${Math.round(weather?.uvIndex ?? 0)}` },
  ];
}
