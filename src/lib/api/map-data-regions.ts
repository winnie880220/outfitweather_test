import { fetchMapColors, type MapDataRegion } from "./map-colors";

export type { MapDataRegion };

export type MapDataRegionsData = {
  regions: MapDataRegion[];
};

/** 從 /api/map-colors 取得有穿搭色票資料的區域 */
export async function fetchMapDataRegions(): Promise<MapDataRegionsData> {
  const { regions } = await fetchMapColors();
  return { regions };
}
