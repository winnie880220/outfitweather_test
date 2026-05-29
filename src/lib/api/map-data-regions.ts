import { apiGet } from "./client";

export type MapDataRegion = {
  regionKey: string;
  county: string;
  district?: string;
};

export type MapDataRegionsData = {
  regions: MapDataRegion[];
};

/** GET /api/map-data-regions — 有穿搭色票資料的區域 */
export async function fetchMapDataRegions(): Promise<MapDataRegionsData> {
  return apiGet<MapDataRegionsData>("/api/map-data-regions");
}
