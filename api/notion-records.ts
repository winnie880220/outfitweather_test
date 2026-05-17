import type { NotionRecordPayload } from "./lib/types";
import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";
import { createRecordInNotion, updateRecordInNotion } from "./lib/notion/records";

/** POST /api/notion-records | PATCH /api/notion-records */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const body = req.body as NotionRecordPayload;
    if (!body?.userName?.trim()) {
      return sendJson(res, 400, { ok: false, error: "缺少 userName" });
    }
    const result = await createRecordInNotion(body);
    return sendJson(res, result.ok ? 201 : 502, result);
  }

  if (req.method === "PATCH") {
    const body = req.body as NotionRecordPayload & { pageId?: string };
    if (!body?.pageId) {
      return sendJson(res, 400, { ok: false, error: "缺少 pageId" });
    }
    const { pageId, ...payload } = body;
    const result = await updateRecordInNotion(pageId, payload);
    return sendJson(res, result.ok ? 200 : 502, result);
  }

  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
}
