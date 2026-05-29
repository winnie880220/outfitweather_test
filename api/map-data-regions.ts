import { getMapDataRegions } from "./lib/notion/map-data-regions";
import { isNotionConfigured } from "./lib/env";
import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

/** GET /api/map-data-regions — 資料庫中有穿搭色票的區域列表 */
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
    const regions = await getMapDataRegions();
    return sendJson(res, 200, { ok: true, data: { regions }, source: "notion" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "區域列表失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
