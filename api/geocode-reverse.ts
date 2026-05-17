import { reverseGeocode } from "./lib/geocode";
import { edgeConfig, getSearchParams, jsonResponse, parseLatLon } from "./lib/edge";

export const config = edgeConfig;

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const coords = parseLatLon(getSearchParams(request));
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
