import type { WeatherData } from "../src/types/api";
import { TAIPEI_COUNTY, type TaipeiDistrict } from "./taipei-district";
import type { TaiwanCounty } from "./taiwan-county";
import { regionKey, type MapRegion } from "./map-region";
import {
  getInsightTempDeltaFromWeather,
  type MapFillLocaleSpec,
} from "./map-fill-locales";
import { weatherInsightReferenceTemp } from "./weather-insight-temp";

export type MapDataRegionLike = {
  regionKey: string;
  county: TaiwanCounty;
  district?: TaipeiDistrict;
};

export function mapDataRegionToMapRegion(r: MapDataRegionLike): MapRegion {
  if (r.district) {
    return { level: "district", county: TAIPEI_COUNTY, district: r.district };
  }
  return { level: "county", county: r.county };
}

/** 取得該區「目前已載入」的天氣：區域 key → 縣市 → 全域定位天氣 */
export function resolveWeatherForRegion(
  region: MapRegion,
  weatherByKey: Record<string, WeatherData | undefined>,
  fallback: WeatherData | null
): WeatherData | null {
  const direct = weatherByKey[regionKey(region)];
  if (direct) return direct;
  if (region.level === "district") {
    const countyWeather = weatherByKey[region.county];
    if (countyWeather) return countyWeather;
  }
  return fallback;
}

export function weatherInsightSig(w: WeatherData): string {
  const ref = Math.round(weatherInsightReferenceTemp(w));
  const delta = getInsightTempDeltaFromWeather(w);
  return `${ref}@d${delta}`;
}

export function regionInsightFetchKey(region: MapRegion, w: WeatherData): string {
  return `${regionKey(region)}@${weatherInsightSig(w)}`;
}

/** 與排行 API 相同參數的單區填色 spec */
export function buildMapFillSpecForRegion(
  region: MapRegion,
  w: WeatherData
): MapFillLocaleSpec {
  const ref = weatherInsightReferenceTemp(w);
  return {
    regionKey: regionKey(region),
    county: region.county,
    ...(region.level === "district" ? { district: region.district } : {}),
    refTemp: ref,
    airTemp: w.temp,
    delta: getInsightTempDeltaFromWeather(w),
  };
}
