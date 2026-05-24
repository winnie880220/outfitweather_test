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

export async function getMapColorPoints(): Promise<MapColorPoint[]> {
  const records = await queryRecordsWithColors();
  return recordsToMapColorPoints(records);
}
