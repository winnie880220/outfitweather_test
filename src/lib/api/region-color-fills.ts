import type { MapFillLocaleSpec } from "../../../lib/map-fill-locales";
import { apiGet, apiPost } from "./client";

export type RegionColorFill = {
  regionKey: string;
  county: string;
  district?: string;
  colorName: string;
  hex: string;
  colorName2?: string;
  hex2?: string;
  colorName3?: string;
  hex3?: string;
};

export type RegionColorFillsData = {
  fills: RegionColorFill[];
};

/** GET /api/region-color-fills?temp=26&delta=1（temp 為體感溫度參考值） */
export async function fetchRegionColorFills(
  temp: number,
  delta = 1,
  options?: { airTemp?: number }
): Promise<RegionColorFillsData> {
  const params = new URLSearchParams({
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
  return apiGet<RegionColorFillsData>(`/api/region-color-fills?${params}`);
}

/** POST /api/region-color-fills — 各地圖區塊依各自體感溫度查填色 */
export async function fetchRegionColorFillsByLocale(
  locales: MapFillLocaleSpec[]
): Promise<RegionColorFillsData> {
  return apiPost<RegionColorFillsData>("/api/region-color-fills", { locales });
}
