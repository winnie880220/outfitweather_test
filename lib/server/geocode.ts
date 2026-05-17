import type { GeoSearchResult } from "../../src/types/api";

/**
 * 地點搜尋：Open-Meteo Geocoding（與天氣同源，Vercel 上穩定）
 * 反向定位：Photon（Komoot，允許伺服器請求）
 */
export async function searchLocations(query: string): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=zh`
  );

  if (!res.ok) {
    throw new Error(`地點搜尋失敗 (${res.status})`);
  }

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

/** GET /api/geocode/reverse */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=zh`
  );

  if (!res.ok) {
    throw new Error(`反向定位失敗 (${res.status})`);
  }

  const data = (await res.json()) as {
    features?: Array<{
      properties?: {
        name?: string;
        city?: string;
        locality?: string;
        state?: string;
        country?: string;
      };
    }>;
  };

  const p = data.features?.[0]?.properties;
  if (!p) {
    throw new Error("無法解析目前位置");
  }

  const city = p.city || p.locality || p.state || "";
  const district = p.name && p.name !== city ? p.name : "";
  const label = [city, district].filter(Boolean).join(" ").trim();

  return label || p.country || "未知地點";
}
