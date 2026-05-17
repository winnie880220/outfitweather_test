import { searchLocations } from "./lib/geocode";
import { getQueryString, sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

/** GET /api/geocode-search?q=台北 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const q = getQueryString(req.query, "q");
  if (q.trim().length < 2) {
    return sendJson(res, 400, { ok: false, error: "搜尋字串至少 2 個字" });
  }

  try {
    const data = await searchLocations(q);
    return sendJson(res, 200, { ok: true, data, source: "api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "地點搜尋失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
