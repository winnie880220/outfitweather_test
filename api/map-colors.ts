import {
  getMapColorsBundle,
  getMapDataRegionsFromRecords,
  getMapRegionsWithColorFills,
} from "./lib/notion/map-colors";
import { isNotionConfigured } from "./lib/env";
import { getQueryString, sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

/** GET /api/map-colors — 色票點 + 有資料區域；?scope=regions 僅回傳區域列表（較快） */
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

  try {
    const scope = getQueryString(req.query, "scope");
    if (scope === "regions") {
      const tempRaw = getQueryString(req.query, "temp");
      const temp = tempRaw ? parseFloat(tempRaw) : Number.NaN;
      if (!Number.isNaN(temp)) {
        const deltaRaw = getQueryString(req.query, "delta");
        const delta = deltaRaw ? parseFloat(deltaRaw) : 1;
        const safeDelta = Number.isNaN(delta) ? 1 : Math.min(3, Math.max(0, delta));
        const airTempRaw = getQueryString(req.query, "airTemp");
        const airTempParsed = airTempRaw ? parseFloat(airTempRaw) : Number.NaN;
        const airTemp = Number.isNaN(airTempParsed) ? undefined : airTempParsed;
        const { regions, fills } = await getMapRegionsWithColorFills(
          temp,
          safeDelta,
          airTemp
        );
        return sendJson(res, 200, {
          ok: true,
          data: { regions, fills },
          source: "notion",
        });
      }
      const regions = await getMapDataRegionsFromRecords();
      return sendJson(res, 200, { ok: true, data: { regions }, source: "notion" });
    }
    const { points, regions } = await getMapColorsBundle();
    return sendJson(res, 200, { ok: true, data: { points, regions }, source: "notion" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "地圖色票載入失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
