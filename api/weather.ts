import { getCurrentWeather, getWeatherProvider } from "./lib/weather";
import { getQueryString, parseLatLonFromQuery, sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

/** GET /api/weather?lat=25.03&lon=121.56&name=台北市 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const coords = parseLatLonFromQuery(req.query);
  if (!coords) {
    return sendJson(res, 400, { ok: false, error: "請提供有效的 lat、lon 參數" });
  }

  const displayName = getQueryString(req.query, "name") || undefined;

  try {
    const data = await getCurrentWeather(coords.lat, coords.lon, displayName);
    return sendJson(res, 200, {
      ok: true,
      data,
      source: "api",
      provider: getWeatherProvider(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "天氣取得失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
