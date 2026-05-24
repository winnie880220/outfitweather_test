import type { WeatherData } from "../src/types/api";

export function hasDailyTempRange(weather: WeatherData | null | undefined): boolean {
  return (
    weather != null &&
    typeof weather.tempMin === "number" &&
    !Number.isNaN(weather.tempMin) &&
    typeof weather.tempMax === "number" &&
    !Number.isNaN(weather.tempMax)
  );
}

/** 今日最低溫 – 最高溫（低在前、高在後） */
export function formatTodayTempRange(weather: WeatherData): string {
  const low = Math.round(Math.min(weather.tempMin!, weather.tempMax!));
  const high = Math.round(Math.max(weather.tempMin!, weather.tempMax!));
  return `今日 ${low}° – ${high}°`;
}
