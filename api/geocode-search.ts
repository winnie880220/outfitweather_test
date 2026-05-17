import { searchLocations } from "./lib/geocode";
import { edgeConfig, getSearchParams, jsonResponse } from "./lib/edge";

export const config = edgeConfig;

/** GET /api/geocode-search?q=台北 */
export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const q = getSearchParams(request).get("q")?.trim() ?? "";
  if (q.length < 2) {
    return jsonResponse(400, { ok: false, error: "搜尋字串至少 2 個字" });
  }

  try {
    const data = await searchLocations(q);
    return jsonResponse(200, { ok: true, data, source: "api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "地點搜尋失敗";
    return jsonResponse(500, { ok: false, error: message });
  }
}
