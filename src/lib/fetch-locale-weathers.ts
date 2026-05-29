import type { WeatherData } from "../types/api";
import { fetchCurrentWeather } from "./api/weather";
import type { LocaleWeatherTarget } from "../../lib/map-fill-locales";

const DEFAULT_CONCURRENCY = 4;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/** 並行取得各地圖區塊的當下天氣（失敗的區塊略過） */
export async function fetchLocaleWeatherMap(
  targets: LocaleWeatherTarget[],
  concurrency = DEFAULT_CONCURRENCY
): Promise<Record<string, WeatherData>> {
  const map: Record<string, WeatherData> = {};

  await mapPool(targets, concurrency, async (target) => {
    try {
      const data = await fetchCurrentWeather(target.lat, target.lon, target.name);
      map[target.regionKey] = data;
    } catch (error) {
      console.warn(`Locale weather ${target.regionKey}:`, error);
    }
  });

  return map;
}
