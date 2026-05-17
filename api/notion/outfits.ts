import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { CreateOutfitPayload } from "../../src/types/api";
import { methodNotAllowed, sendJson } from "../../lib/server/http";
import { createOutfitInNotion, listOutfitsFromNotion } from "../../lib/server/notion/outfits";

/**
 * GET  /api/notion/outfits  — 讀取穿搭／衣櫥（Notion Database）
 * POST /api/notion/outfits  — 新增穿搭紀錄
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const result = await listOutfitsFromNotion();
    return sendJson(res, result.ok ? 200 : 501, result);
  }

  if (req.method === "POST") {
    const body = req.body as CreateOutfitPayload | undefined;
    if (!body?.userName) {
      return sendJson(res, 400, { ok: false, error: "缺少 userName" });
    }
    const result = await createOutfitInNotion(body);
    return sendJson(res, result.ok ? 201 : 501, result);
  }

  return methodNotAllowed(res);
}
