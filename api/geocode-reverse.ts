import { reverseGeocode } from "./lib/geocode";
import { parseLatLonFromQuery, sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const coords = parseLatLonFromQuery(req.query);
  if (!coords) {
    return sendJson(res, 400, { ok: false, error: "請提供有效的 lat、lon 參數" });
  }

  try {
    const name = await reverseGeocode(coords.lat, coords.lon);
    return sendJson(res, 200, { ok: true, data: { name }, source: "api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "反查地點失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
