import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchLocations } from "../../lib/server/geocode";
import { badRequest, methodNotAllowed, sendJson } from "../../lib/server/http";

/**
 * GET /api/geocode/search?q=台北
 * 地點搜尋建議（Nominatim，由 Vercel 代理）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (q.trim().length < 2) return badRequest(res, "搜尋字串至少 2 個字");

  try {
    const data = await searchLocations(q);
    sendJson(res, 200, { ok: true, data, source: "api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "地點搜尋失敗";
    sendJson(res, 500, { ok: false, error: message });
  }
}
