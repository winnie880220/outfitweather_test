import type { GeoSearchResult } from "../../src/types/api";

const NOMINATIM_HEADERS = { "User-Agent": "OutfitWeatherApp/1.0" };

/** GET /api/geocode/reverse */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=zh`,
    { headers: NOMINATIM_HEADERS }
  );

  if (!geoRes.ok) {
    throw new Error("無法解析地點");
  }

  const geoData = await geoRes.json();
  const addr = geoData.address || {};
  const city = addr.city || addr.town || addr.village || addr.municipality || "";
  const district = addr.suburb || addr.district || addr.county || "";
  return `${city} ${district}`.trim() || geoData.display_name?.split(",")[0] || "未知地點";
}

/** GET /api/geocode/search */
export async function searchLocations(query: string): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=tw&accept-language=zh&limit=6`,
    { headers: NOMINATIM_HEADERS }
  );

  if (!res.ok) return [];
  return res.json();
}
