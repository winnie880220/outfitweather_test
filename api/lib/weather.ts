import type { WeatherData } from "./types";
import { isGoogleWeatherConfigured } from "./env";
import { getCurrentWeatherFromGoogle } from "./google-weather";
import { getCurrentWeatherFromOpenMeteo } from "./open-meteo-weather";

let lastResolvedProvider: "google" | "open-meteo" = "open-meteo";

export async function getCurrentWeather(
  lat: number,
  lon: number,
  displayName?: string
): Promise<WeatherData> {
  if (isGoogleWeatherConfigured()) {
    try {
      const data = await getCurrentWeatherFromGoogle(lat, lon, displayName);
      lastResolvedProvider = "google";
      return data;
    } catch (error) {
      console.warn(
        "[weather] Google Weather 失敗，改使用 Open-Meteo:",
        error instanceof Error ? error.message : error
      );
    }
  }
  const data = await getCurrentWeatherFromOpenMeteo(lat, lon, displayName);
  lastResolvedProvider = "open-meteo";
  return data;
}

/** 最近一次成功取得天氣的來源（含 Google 失敗後備） */
export function getWeatherProvider(): "google" | "open-meteo" {
  return lastResolvedProvider;
}
