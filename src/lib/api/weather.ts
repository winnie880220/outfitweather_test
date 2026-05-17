import type { WeatherData } from "../../types/api";
import { apiGet } from "./client";

/** GET /api/weather */
export async function fetchCurrentWeather(
  lat: number,
  lon: number,
  displayName?: string
): Promise<WeatherData> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  });
  if (displayName?.trim()) {
    params.set("name", displayName.trim());
  }
  return apiGet<WeatherData>(`/api/weather?${params}`);
}
