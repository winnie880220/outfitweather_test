import { apiGet } from "./client";

export type RegionColorFill = {
  regionKey: string;
  county: string;
  district?: string;
  colorName: string;
  hex: string;
};

export type RegionColorFillsData = {
  fills: RegionColorFill[];
};

/** GET /api/region-color-fills?temp=26&delta=1 */
export async function fetchRegionColorFills(
  temp: number,
  delta = 1
): Promise<RegionColorFillsData> {
  const params = new URLSearchParams({
    temp: String(Math.round(temp)),
    delta: String(delta),
  });
  return apiGet<RegionColorFillsData>(`/api/region-color-fills?${params}`);
}
