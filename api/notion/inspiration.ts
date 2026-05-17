import type { VercelRequest, VercelResponse } from "@vercel/node";
import { methodNotAllowed, sendJson } from "../../lib/server/http";
import { listInspirationFromNotion } from "../../lib/server/notion/inspiration";

/**
 * GET /api/notion/inspiration
 * 今日靈感卡片（Notion Database）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const result = await listInspirationFromNotion();
  return sendJson(res, result.ok ? 200 : 501, result);
}
