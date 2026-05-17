import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCurrentWeather } from "../lib/server/weather";
import { badRequest, methodNotAllowed, parseLatLon, sendJson } from "../lib/server/http";

/**
 * GET /api/weather?lat=25.03&lon=121.56&name=台北市
 * 天氣資料（Open-Meteo，由 Vercel 代理）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const coords = parseLatLon(req);
  if (!coords) return badRequest(res, "請提供有效的 lat、lon 參數");

  const displayName = typeof req.query.name === "string" ? req.query.name : undefined;

  try {
    const data = await getCurrentWeather(coords.lat, coords.lon, displayName);
    sendJson(res, 200, { ok: true, data, source: "api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "天氣取得失敗";
    sendJson(res, 500, { ok: false, error: message });
  }
}
