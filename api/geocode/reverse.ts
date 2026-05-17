import { reverseGeocode } from "../lib/geocode";
import { jsonResponse, parseLatLon } from "../lib/http";

export const config = { runtime: "nodejs" };

/** GET /api/geocode/reverse?lat=25.03&lon=121.56 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const coords = parseLatLon(new URL(request.url));
  if (!coords) {
    return jsonResponse(400, { ok: false, error: "請提供有效的 lat、lon 參數" });
  }

  try {
    const name = await reverseGeocode(coords.lat, coords.lon);
    return jsonResponse(200, { ok: true, data: { name }, source: "api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "反查地點失敗";
    return jsonResponse(500, { ok: false, error: message });
  }
}
