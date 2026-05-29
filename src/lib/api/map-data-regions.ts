import type { RegionColorFill } from "./region-color-fills";
import { apiGet } from "./client";
import { fetchMapColors, type MapDataRegion } from "./map-colors";

export type { MapDataRegion };

export type MapDataRegionsData = {
  regions: MapDataRegion[];
};

export type MapBootstrapData = {
  regions: MapDataRegion[];
  fills: RegionColorFill[];
};

/** 從 /api/map-colors?scope=regions 取得有穿搭色票資料的區域 */
export async function fetchMapDataRegions(): Promise<MapDataRegionsData> {
  return apiGet<MapDataRegionsData>("/api/map-colors?scope=regions");
}

/**
 * 一次取得有資料區域 + 各區填色（以同一體感溫度區間查 Notion，進場即顯示）
 */
export async function fetchMapBootstrapWithFills(
  temp: number,
  delta = 1,
  options?: { airTemp?: number }
): Promise<MapBootstrapData> {
  const params = new URLSearchParams({
    scope: "regions",
    temp: String(Math.round(temp)),
    delta: String(delta),
  });
  if (
    options?.airTemp != null &&
    Number.isFinite(options.airTemp) &&
    Math.round(options.airTemp) !== Math.round(temp)
  ) {
    params.set("airTemp", String(Math.round(options.airTemp)));
  }
  return apiGet<MapBootstrapData>(`/api/map-colors?${params}`);
}

/** @deprecated 請改用 fetchMapBootstrapWithFills */
export async function fetchMapDataRegionsWithFills(
  temp: number,
  delta = 1,
  options?: { airTemp?: number }
): Promise<MapBootstrapData> {
  return fetchMapBootstrapWithFills(temp, delta, options);
}

export { fetchMapColors };
