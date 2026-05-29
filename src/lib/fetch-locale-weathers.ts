import type { WeatherData } from "../types/api";
import { fetchCurrentWeather } from "./api/weather";
import type { LocaleWeatherTarget } from "../../lib/map-fill-locales";

const DEFAULT_CONCURRENCY = 6;

function sortTargetsByPriority(
  targets: LocaleWeatherTarget[],
  priorityKeys: ReadonlySet<string>
): LocaleWeatherTarget[] {
  if (priorityKeys.size === 0) return targets;
  const priority: LocaleWeatherTarget[] = [];
  const rest: LocaleWeatherTarget[] = [];
  for (const t of targets) {
    if (priorityKeys.has(t.regionKey)) priority.push(t);
    else rest.push(t);
  }
  return [...priority, ...rest];
}

/** 並行取得各地圖區塊天氣；每完成一區即回呼（供漸進填色） */
export async function fetchLocaleWeatherMapProgressive(
  targets: LocaleWeatherTarget[],
  onRegion: (regionKey: string, data: WeatherData) => void,
  options?: {
    concurrency?: number;
    priorityKeys?: string[];
    shouldContinue?: () => boolean;
  }
): Promise<void> {
  if (targets.length === 0) return;

  const prioritySet = new Set(options?.priorityKeys ?? []);
  const ordered = sortTargetsByPriority(targets, prioritySet);
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  let index = 0;

  async function worker() {
    while (index < ordered.length) {
      if (options?.shouldContinue && !options.shouldContinue()) return;
      const i = index++;
      const target = ordered[i]!;
      try {
        const data = await fetchCurrentWeather(target.lat, target.lon, target.name);
        if (options?.shouldContinue && !options.shouldContinue()) return;
        onRegion(target.regionKey, data);
      } catch (error) {
        console.warn(`Locale weather ${target.regionKey}:`, error);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ordered.length) }, () => worker())
  );
}

/** 並行取得各地圖區塊的當下天氣（失敗的區塊略過） */
export async function fetchLocaleWeatherMap(
  targets: LocaleWeatherTarget[],
  concurrency = DEFAULT_CONCURRENCY
): Promise<Record<string, WeatherData>> {
  const map: Record<string, WeatherData> = {};
  await fetchLocaleWeatherMapProgressive(
    targets,
    (key, data) => {
      map[key] = data;
    },
    { concurrency }
  );
  return map;
}
