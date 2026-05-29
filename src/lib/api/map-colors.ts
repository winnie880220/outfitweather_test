import { apiGet } from "./client";

export type MapColorPoint = {
  id: string;
  county: string;
  district?: string;
  colorName: string;
  lat: number;
  lon: number;
};

export type MapDataRegion = {
  regionKey: string;
  county: string;
  district?: string;
};

export type MapColorsData = {
  points: MapColorPoint[];
  regions: MapDataRegion[];
};

/** GET /api/map-colors */
export async function fetchMapColors(): Promise<MapColorsData> {
  return apiGet<MapColorsData>("/api/map-colors");
}
