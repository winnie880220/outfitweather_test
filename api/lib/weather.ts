import type { WeatherData } from "./types";
import { isGoogleWeatherConfigured } from "./env";
import { getCurrentWeatherFromGoogle } from "./google-weather";
import { getCurrentWeatherFromOpenMeteo } from "./open-meteo-weather";

export async function getCurrentWeather(
  lat: number,
  lon: number,
  displayName?: string
): Promise<WeatherData> {
  if (isGoogleWeatherConfigured()) {
    return getCurrentWeatherFromGoogle(lat, lon, displayName);
  }
  return getCurrentWeatherFromOpenMeteo(lat, lon, displayName);
}

/** 目前使用的天氣來源（除錯／回應標示用） */
export function getWeatherProvider(): "google" | "open-meteo" {
  return isGoogleWeatherConfigured() ? "google" : "open-meteo";
}
