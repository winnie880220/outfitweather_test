import { searchLocations } from "../lib/geocode";
import { jsonResponse } from "../lib/http";

export const config = { runtime: "nodejs" };

/** GET /api/geocode/search?q=台北 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
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
