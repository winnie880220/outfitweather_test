import type { VercelRequest, VercelResponse } from "@vercel/node";
import { reverseGeocode } from "../../lib/server/geocode";
import { badRequest, methodNotAllowed, parseLatLon, sendJson } from "../../lib/server/http";

/**
 * GET /api/geocode/reverse?lat=25.03&lon=121.56
 * 經緯度反查地點名稱
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const coords = parseLatLon(req);
  if (!coords) return badRequest(res, "請提供有效的 lat、lon 參數");

  try {
    const name = await reverseGeocode(coords.lat, coords.lon);
    sendJson(res, 200, { ok: true, data: { name }, source: "api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "反查地點失敗";
    sendJson(res, 500, { ok: false, error: message });
  }
}
