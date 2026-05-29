import { parseLocationToRegion } from "../../../lib/map-region";
import {
  TAIPEI_COUNTY,
  TAIPEI_DISTRICT_CENTROIDS,
  type TaipeiDistrict,
} from "../../../lib/taipei-district";
import {
  COUNTY_CENTROIDS,
  type TaiwanCounty,
} from "../../../lib/taiwan-county";
import type { ParsedNotionRecord } from "./parse-page";
import { collectMapDataRegions, type MapDataRegion } from "./map-data-regions";
import {
  getRegionColorFillsForLocales,
  type RegionColorFill,
} from "./outfit-insights";
import type { MapFillLocaleSpec } from "../../../lib/map-fill-locales";
import { queryRecordsWithColors } from "./query-records";

export type MapColorPoint = {
  id: string;
  county: TaiwanCounty;
  /** 僅台北市紀錄可能有值 */
  district?: TaipeiDistrict;
  colorName: string;
  lat: number;
  lon: number;
};

const MAX_POINTS = 400;

function jitterIndex(index: number, total: number, baseLat: number, baseLon: number) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const radius = total > 1 ? 0.012 + index * 0.003 : 0;
  return {
    lat: baseLat + Math.sin(angle) * radius,
    lon: baseLon + Math.cos(angle) * radius,
  };
}

function resolveCoords(
  county: TaiwanCounty,
  district?: TaipeiDistrict
): [number, number] {
  if (county === TAIPEI_COUNTY && district) {
    return TAIPEI_DISTRICT_CENTROIDS[district];
  }
  return COUNTY_CENTROIDS[county];
}

export function recordsToMapColorPoints(records: ParsedNotionRecord[]): MapColorPoint[] {
  const points: MapColorPoint[] = [];

  for (const record of records) {
    const region = parseLocationToRegion(record.location);
    if (!region) continue;

    const colors = record.colors.map((c) => c.trim()).filter(Boolean);
    if (colors.length === 0) continue;

    const county = region.county;
    const district = region.level === "district" ? region.district : undefined;
    const [baseLat, baseLon] = resolveCoords(county, district);
    const unique = [...new Set(colors)].slice(0, 3);

    unique.forEach((colorName, index) => {
      const { lat, lon } = jitterIndex(index, unique.length, baseLat, baseLon);
      points.push({
        id: `${record.id}-${colorName}-${index}`,
        county,
        ...(district ? { district } : {}),
        colorName,
        lat,
        lon,
      });
    });
  }

  return points.slice(0, MAX_POINTS);
}

export type MapColorsBundle = {
  points: MapColorPoint[];
  regions: MapDataRegion[];
};

/** 一次查詢回傳地圖色票點與有資料區域列表 */
export async function getMapColorsBundle(): Promise<MapColorsBundle> {
  const records = await queryRecordsWithColors();
  return {
    points: recordsToMapColorPoints(records),
    regions: collectMapDataRegions(records),
  };
}

/** 僅區域列表（略過色票點運算，供地圖填色加速） */
export async function getMapDataRegionsFromRecords(): Promise<MapDataRegion[]> {
  const records = await queryRecordsWithColors();
  return collectMapDataRegions(records);
}

export type MapRegionsWithFills = {
  regions: MapDataRegion[];
  fills: RegionColorFill[];
};

/** 有資料區域 + 以同一體感溫度區間一次算出各區填色（進場即顯示） */
export async function getMapRegionsWithColorFills(
  refTemp: number,
  delta: number,
  airTemp?: number
): Promise<MapRegionsWithFills> {
  const regions = await getMapDataRegionsFromRecords();
  if (regions.length === 0) return { regions, fills: [] };

  const air = airTemp ?? refTemp;
  const locales: MapFillLocaleSpec[] = regions.map((r) => ({
    regionKey: r.regionKey,
    county: r.county,
    ...(r.district ? { district: r.district } : {}),
    refTemp,
    airTemp: air,
    delta,
  }));
  const fills = await getRegionColorFillsForLocales(locales);
  return { regions, fills };
}

export async function getMapColorPoints(): Promise<MapColorPoint[]> {
  const { points } = await getMapColorsBundle();
  return points;
}
