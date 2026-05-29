import { parseLocationToRegion, regionKey } from "../../../lib/map-region";
import type { TaipeiDistrict } from "../../../lib/taipei-district";
import type { TaiwanCounty } from "../../../lib/taiwan-county";
import type { ParsedNotionRecord } from "./parse-page";
import { queryRecordsWithColors } from "./query-records";

export type MapDataRegion = {
  regionKey: string;
  county: TaiwanCounty;
  district?: TaipeiDistrict;
};

/** 從有 Color 的紀錄彙整出地圖需填色的區域（去重） */
export function collectMapDataRegions(
  records: ParsedNotionRecord[]
): MapDataRegion[] {
  const map = new Map<string, MapDataRegion>();

  const add = (region: ReturnType<typeof parseLocationToRegion>) => {
    if (!region) return;
    const rk = regionKey(region);
    if (!map.has(rk)) {
      map.set(rk, {
        regionKey: rk,
        county: region.county,
        ...(region.level === "district" ? { district: region.district } : {}),
      });
    }
    if (region.level === "district" && !map.has(region.county)) {
      map.set(region.county, {
        regionKey: region.county,
        county: region.county,
      });
    }
  };

  for (const record of records) {
    if (!record.colors.length) continue;
    add(parseLocationToRegion(record.location));
  }

  return [...map.values()];
}

export async function getMapDataRegions(): Promise<MapDataRegion[]> {
  const records = await queryRecordsWithColors();
  return collectMapDataRegions(records);
}
