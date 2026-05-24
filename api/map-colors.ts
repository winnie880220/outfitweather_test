import { getMapColorPoints } from "./lib/notion/map-colors";
import { isNotionConfigured } from "./lib/env";
import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

/** GET /api/map-colors — 資料庫中有 color 的紀錄，依縣市落在地圖上 */
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
    const points = await getMapColorPoints();
    return sendJson(res, 200, { ok: true, data: { points }, source: "notion" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "地圖色票載入失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
