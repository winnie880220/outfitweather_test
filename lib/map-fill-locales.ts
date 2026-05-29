import { weatherInsightReferenceTemp } from "./weather-insight-temp";
import { regionKey, type MapRegion } from "./map-region";
import {
  TAIPEI_COUNTY,
  TAIPEI_DISTRICT_CENTROIDS,
  TAIPEI_DISTRICTS,
  type TaipeiDistrict,
} from "./taipei-district";
import {
  COUNTY_CENTROIDS,
  TAIWAN_COUNTIES,
  type TaiwanCounty,
} from "./taiwan-county";

export type MapDataRegionLike = {
  regionKey: string;
  county: TaiwanCounty;
  district?: TaipeiDistrict;
};

export type MapFillLocaleSpec = {
  regionKey: string;
  county: TaiwanCounty;
  district?: TaipeiDistrict;
  refTemp: number;
  airTemp: number;
  delta: number;
};

export type LocaleWeatherTarget = {
  regionKey: string;
  lat: number;
  lon: number;
  name: string;
};

/** 僅對有穿搭資料的區域建立天氣查詢目標 */
export function buildLocaleWeatherTargetsForRegions(
  regions: MapDataRegionLike[],
  includeTaipeiDistricts: boolean
): LocaleWeatherTarget[] {
  const seen = new Set<string>();
  const targets: LocaleWeatherTarget[] = [];

  const pushCounty = (county: TaiwanCounty) => {
    if (seen.has(county)) return;
    seen.add(county);
    const [lat, lon] = COUNTY_CENTROIDS[county];
    targets.push({ regionKey: county, lat, lon, name: county });
  };

  const pushDistrict = (district: TaipeiDistrict) => {
    const rk = `${TAIPEI_COUNTY}:${district}`;
    if (seen.has(rk)) return;
    seen.add(rk);
    const [lat, lon] = TAIPEI_DISTRICT_CENTROIDS[district];
    targets.push({
      regionKey: rk,
      lat,
      lon,
      name: `${TAIPEI_COUNTY} ${district}`,
    });
  };

  for (const region of regions) {
    if (region.district) {
      if (includeTaipeiDistricts) pushDistrict(region.district);
      pushCounty(region.county);
    } else {
      pushCounty(region.county);
    }
  }

  return targets;
}

/** @deprecated 改為 buildLocaleWeatherTargetsForRegions（僅有資料區域） */
export function buildLocaleWeatherTargets(
  includeTaipeiDistricts: boolean
): LocaleWeatherTarget[] {
  const targets: LocaleWeatherTarget[] = [];

  for (const county of TAIWAN_COUNTIES) {
    const [lat, lon] = COUNTY_CENTROIDS[county];
    targets.push({
      regionKey: county,
      lat,
      lon,
      name: county,
    });
  }

  if (includeTaipeiDistricts) {
    for (const district of TAIPEI_DISTRICTS) {
      const [lat, lon] = TAIPEI_DISTRICT_CENTROIDS[district];
      const region: MapRegion = {
        level: "district",
        county: TAIPEI_COUNTY,
        district,
      };
      targets.push({
        regionKey: regionKey(region),
        lat,
        lon,
        name: `${TAIPEI_COUNTY} ${district}`,
      });
    }
  }

  return targets;
}

type WeatherLike = {
  temp: number;
  apparentTemp?: number;
  tempMin?: number;
  tempMax?: number;
};

export function getInsightTempDeltaFromWeather(
  weather: WeatherLike | null | undefined
): 1 | 2 {
  if (
    !weather ||
    typeof weather.tempMin !== "number" ||
    Number.isNaN(weather.tempMin) ||
    typeof weather.tempMax !== "number" ||
    Number.isNaN(weather.tempMax)
  ) {
    return 1;
  }
  return Math.abs(weather.tempMax - weather.tempMin) >= 8 ? 2 : 1;
}

/** 依各區當下天氣組出填色查詢參數（可限定仅有資料的 regionKey） */
export function buildMapFillLocaleSpecs(
  weatherByRegionKey: Record<string, WeatherLike | undefined>,
  includeTaipeiDistricts: boolean,
  dataRegionKeys?: ReadonlySet<string>
): MapFillLocaleSpec[] {
  const specs: MapFillLocaleSpec[] = [];
  const inScope = (rk: string, county: TaiwanCounty) =>
    !dataRegionKeys?.size || dataRegionKeys.has(rk) || dataRegionKeys.has(county);

  for (const county of TAIWAN_COUNTIES) {
    if (!inScope(county, county)) continue;
    const w = weatherByRegionKey[county];
    if (!w) continue;
    const ref = weatherInsightReferenceTemp(w);
    if (!Number.isFinite(ref)) continue;
    specs.push({
      regionKey: county,
      county,
      refTemp: ref,
      airTemp: w.temp,
      delta: getInsightTempDeltaFromWeather(w),
    });
  }

  if (includeTaipeiDistricts) {
    for (const district of TAIPEI_DISTRICTS) {
      const rk = `${TAIPEI_COUNTY}:${district}`;
      if (!inScope(rk, TAIPEI_COUNTY)) continue;
      const w = weatherByRegionKey[rk] ?? weatherByRegionKey[TAIPEI_COUNTY];
      if (!w) continue;
      const ref = weatherInsightReferenceTemp(w);
      if (!Number.isFinite(ref)) continue;
      specs.push({
        regionKey: rk,
        county: TAIPEI_COUNTY,
        district,
        refTemp: ref,
        airTemp: w.temp,
        delta: getInsightTempDeltaFromWeather(w),
      });
    }
  }

  return specs;
}

/** 從有資料區域 + 使用者定位，組出優先查天氣的目標（去重） */
export function buildPriorityLocaleWeatherTargets(
  dataRegions: MapDataRegionLike[],
  includeTaipeiDistricts: boolean,
  userRegionKeys: string[] = []
): LocaleWeatherTarget[] {
  const targets = buildLocaleWeatherTargetsForRegions(
    dataRegions,
    includeTaipeiDistricts
  );
  const seen = new Set(targets.map((t) => t.regionKey));

  for (const rk of userRegionKeys) {
    if (seen.has(rk)) continue;
    if (rk.includes(":")) {
      const district = rk.split(":")[1] as TaipeiDistrict | undefined;
      if (!district || !includeTaipeiDistricts) continue;
      if (!TAIPEI_DISTRICT_CENTROIDS[district]) continue;
      const [lat, lon] = TAIPEI_DISTRICT_CENTROIDS[district];
      targets.push({
        regionKey: rk,
        lat,
        lon,
        name: `${TAIPEI_COUNTY} ${district}`,
      });
      seen.add(rk);
      continue;
    }
    if (!COUNTY_CENTROIDS[rk as TaiwanCounty]) continue;
    const county = rk as TaiwanCounty;
    const [lat, lon] = COUNTY_CENTROIDS[county];
    targets.push({ regionKey: county, lat, lon, name: county });
    seen.add(rk);
  }

  return targets;
}
