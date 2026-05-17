import type { GeoSearchResult } from "../../types/api";
import { apiGet } from "./client";

export function formatGeoLabel(item: GeoSearchResult): string {
  const parts = item.display_name.split(",").map((s) => s.trim());
  if (item.name && parts.length > 1) {
    return `${item.name}・${parts[1]}`;
  }
  return parts.slice(0, 2).join("・") || item.display_name;
}

/** 直接呼叫 Open-Meteo（瀏覽器 CORS 允許） */
async function searchLocationsDirect(query: string): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=zh`
  );
  if (!res.ok) throw new Error(`地點搜尋失敗 (${res.status})`);

  const data = (await res.json()) as {
    results?: Array<{
      id?: number;
      name: string;
      latitude: number;
      longitude: number;
      admin1?: string;
      country?: string;
    }>;
  };

  if (!data.results?.length) return [];

  return data.results.map((r, i) => {
    const display_name = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    return {
      place_id: r.id ?? i,
      lat: String(r.latitude),
      lon: String(r.longitude),
      display_name,
      name: r.name,
    };
  });
}

/** 直接呼叫 BigDataCloud（瀏覽器 CORS 允許） */
async function reverseGeocodeDirect(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
  );
  if (!res.ok) throw new Error(`反向定位失敗 (${res.status})`);

  const bdc = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
  };

  const label = [bdc.principalSubdivision, bdc.city || bdc.locality]
    .filter(Boolean)
    .join(" ")
    .trim();

  return label || bdc.countryName || "未知地點";
}

/** GET /api/geocode-search（失敗時改直接呼叫 Open-Meteo） */
export async function searchLocations(query: string): Promise<GeoSearchResult[]> {
  try {
    const params = new URLSearchParams({ q: query.trim() });
    return await apiGet<GeoSearchResult[]>(`/api/geocode-search?${params}`);
  } catch {
    return searchLocationsDirect(query);
  }
}

/** GET /api/geocode-reverse（失敗時改直接呼叫 BigDataCloud） */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });
    const { name } = await apiGet<{ name: string }>(`/api/geocode-reverse?${params}`);
    return name;
  } catch {
    return reverseGeocodeDirect(lat, lon);
  }
}
