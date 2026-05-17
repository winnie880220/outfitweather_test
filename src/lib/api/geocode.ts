import type { GeoSearchResult } from "../../types/api";
import { apiGet } from "./client";

export function formatGeoLabel(item: GeoSearchResult): string {
  const parts = item.display_name.split(",").map((s) => s.trim());
  if (item.name && parts.length > 1) {
    return `${item.name}・${parts[1]}`;
  }
  return parts.slice(0, 2).join("・") || item.display_name;
}

/** GET /api/geocode/search */
export async function searchLocations(query: string): Promise<GeoSearchResult[]> {
  const params = new URLSearchParams({ q: query.trim() });
  return apiGet<GeoSearchResult[]>(`/api/geocode/search?${params}`);
}

/** GET /api/geocode/reverse */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  });
  const { name } = await apiGet<{ name: string }>(`/api/geocode/reverse?${params}`);
  return name;
}
