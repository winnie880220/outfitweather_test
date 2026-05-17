import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { NotionRecordPayload } from "../../src/types/api";
import { methodNotAllowed, sendJson } from "../../lib/server/http";
import { createRecordInNotion, updateRecordInNotion } from "../../lib/server/notion/records";

/**
 * POST   /api/notion/records       — 建立紀錄（穿搭+天氣）
 * PATCH  /api/notion/records       — 更新同一筆（體感），body 需含 pageId
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const body = req.body as NotionRecordPayload | undefined;
    if (!body?.userName?.trim()) {
      return sendJson(res, 400, { ok: false, error: "缺少 userName" });
    }
    const result = await createRecordInNotion(body);
    return sendJson(res, result.ok ? 201 : 502, result);
  }

  if (req.method === "PATCH") {
    const body = req.body as NotionRecordPayload & { pageId?: string };
    const pageId = body?.pageId;
    if (!pageId) {
      return sendJson(res, 400, { ok: false, error: "缺少 pageId" });
    }
    const { pageId: _, ...payload } = body;
    const result = await updateRecordInNotion(pageId, payload);
    return sendJson(res, result.ok ? 200 : 502, result);
  }

  return methodNotAllowed(res);
}
