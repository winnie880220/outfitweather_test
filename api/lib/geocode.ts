import type { GeoSearchResult } from "./types";
import { httpFetch } from "./http-fetch";

/** Photon 支援中文「台北」；Open-Meteo 常無結果 */
export async function searchLocationsPhoton(query: string): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await httpFetch(
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
      name: p.name || p.city || display_name,
    };
  });
}

export async function searchLocations(query: string): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await httpFetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=zh`
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
      country_code?: string;
    }>;
  };

  if (!data.results?.length) {
    return searchLocationsPhoton(q);
  }

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

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const bdcRes = await httpFetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
    );
    if (bdcRes.ok) {
      const bdc = (await bdcRes.json()) as {
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryName?: string;
      };
      const label = [bdc.principalSubdivision, bdc.city || bdc.locality]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (label) return label;
      if (bdc.countryName) return bdc.countryName;
    }
  } catch {
    /* fallback */
  }

  const photonRes = await httpFetch(
    `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=en`
  );

  if (!photonRes.ok) {
    throw new Error(`反向定位失敗 (${photonRes.status})`);
  }

  const data = (await photonRes.json()) as {
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
