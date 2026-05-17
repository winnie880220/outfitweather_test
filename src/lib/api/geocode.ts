import type { GeoSearchResult } from "../../types/api";
import { apiGet } from "./client";

export function formatGeoLabel(item: GeoSearchResult): string {
  const parts = item.display_name.split(",").map((s) => s.trim());
  if (item.name && parts.length > 1) {
    return `${item.name}・${parts[1]}`;
  }
  return parts.slice(0, 2).join("・") || item.display_name;
}

async function searchOpenMeteo(query: string): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=zh`
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{
      id?: number;
      name: string;
      latitude: number;
      longitude: number;
      admin1?: string;
      country?: string;
      country_code?: string;
    }>;
  };

  if (!data.results?.length) return [];

  const twFirst = data.results.filter((r) => r.country_code === "TW");
  const list = (twFirst.length ? twFirst : data.results).slice(0, 6);

  return list.map((r, i) => {
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

/** Photon 支援中文「台北」等關鍵字 */
async function searchPhoton(query: string): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=12&lang=default`
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    features?: Array<{
      properties?: {
        osm_id?: number;
        name?: string;
        city?: string;
        state?: string;
        country?: string;
        countrycode?: string;
      };
      geometry?: { coordinates?: [number, number] };
    }>;
  };

  const features = data.features ?? [];
  const tw = features.filter((f) => f.properties?.countrycode === "TW");
  const list = (tw.length ? tw : features).slice(0, 6);

  return list.map((f, i) => {
    const p = f.properties ?? {};
    const [lon, lat] = f.geometry?.coordinates ?? [0, 0];
    const display_name = [p.name, p.city, p.state, p.country].filter(Boolean).join(", ");
    return {
      place_id: p.osm_id ?? i,
      lat: String(lat),
      lon: String(lon),
      display_name,
      name: p.name || p.city || p.state || display_name,
    };
  });
}

async function searchLocationsDirect(query: string): Promise<GeoSearchResult[]> {
  const fromMeteo = await searchOpenMeteo(query);
  if (fromMeteo.length > 0) return fromMeteo;
  return searchPhoton(query);
}

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

export async function searchLocations(query: string): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  // 優先瀏覽器直連（Open-Meteo 對「台北」常無結果；Vercel /api 可能暫時不可用）
  const direct = await searchLocationsDirect(q);
  if (direct.length > 0) return direct;

  try {
    const params = new URLSearchParams({ q });
    return await apiGet<GeoSearchResult[]>(`/api/geocode-search?${params}`);
  } catch {
    return [];
  }
}

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
