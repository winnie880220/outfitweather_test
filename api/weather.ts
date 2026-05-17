import { getCurrentWeather } from "./lib/weather";
import { jsonResponse, parseLatLon } from "./lib/http";

export const config = { runtime: "nodejs" };

/** GET /api/weather?lat=25.03&lon=121.56&name=台北市 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const url = new URL(request.url);
  const coords = parseLatLon(url);
  if (!coords) {
    return jsonResponse(400, { ok: false, error: "請提供有效的 lat、lon 參數" });
  }

  const displayName = url.searchParams.get("name") ?? undefined;

  try {
    const data = await getCurrentWeather(coords.lat, coords.lon, displayName || undefined);
    return jsonResponse(200, { ok: true, data, source: "api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "天氣取得失敗";
    return jsonResponse(500, { ok: false, error: message });
  }
}
