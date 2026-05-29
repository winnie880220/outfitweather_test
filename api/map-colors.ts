import { getMapColorsBundle } from "./lib/notion/map-colors";
import { isNotionConfigured } from "./lib/env";
import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

/** GET /api/map-colors — 色票點 + 有資料區域列表（共用一次 Notion 查詢） */
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
    const { points, regions } = await getMapColorsBundle();
    return sendJson(res, 200, { ok: true, data: { points, regions }, source: "notion" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "地圖色票載入失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
