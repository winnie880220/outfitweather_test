import { getOutfitInsights } from "./lib/notion/outfit-insights";
import { isNotionConfigured } from "./lib/env";
import { getQueryString, sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

/** GET /api/outfit-insights?temp=26&delta=1（temp＝體感溫度）&county=台北市&district=大安區 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!isNotionConfigured()) {
    return sendJson(res, 503, {
      ok: false,
      error: "NOTION_API_KEY 或 NOTION_DATABASE_ID 尚未設定",
    });
  }

  const tempRaw = getQueryString(req.query, "temp");
  const temp = parseFloat(tempRaw);
  if (Number.isNaN(temp)) {
    return sendJson(res, 400, { ok: false, error: "請提供有效的 temp 參數" });
  }

  const deltaRaw = getQueryString(req.query, "delta");
  const delta = deltaRaw ? parseFloat(deltaRaw) : 1;
  const safeDelta = Number.isNaN(delta) ? 1 : Math.min(3, Math.max(0, delta));

  const county = getQueryString(req.query, "county") || undefined;
  const district = getQueryString(req.query, "district") || undefined;
  const airTempRaw = getQueryString(req.query, "airTemp");
  const airTempParsed = airTempRaw ? parseFloat(airTempRaw) : Number.NaN;
  const fallbackTemp = Number.isNaN(airTempParsed) ? undefined : airTempParsed;

  try {
    const data = await getOutfitInsights(temp, safeDelta, county, district, {
      fallbackTemp,
    });
    return sendJson(res, 200, { ok: true, data, source: "notion" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "穿搭統計失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
