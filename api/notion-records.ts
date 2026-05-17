import type { NotionRecordPayload } from "./lib/types";
import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";
import { createRecordInNotion, updateRecordInNotion } from "./lib/notion/records";

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return {};
}

/** POST /api/notion-records | PATCH /api/notion-records */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "POST") {
      const body = (await readJsonBody(req)) as NotionRecordPayload;
      if (!body?.userName?.trim()) {
        return sendJson(res, 400, { ok: false, error: "缺少 userName" });
      }
      const result = await createRecordInNotion(body);
      return sendJson(res, result.ok ? 201 : 502, result);
    }

    if (req.method === "PATCH") {
      const body = (await readJsonBody(req)) as NotionRecordPayload & { pageId?: string };
      if (!body?.pageId) {
        return sendJson(res, 400, { ok: false, error: "缺少 pageId" });
      }
      const { pageId, ...payload } = body;
      const result = await updateRecordInNotion(pageId, payload);
      return sendJson(res, result.ok ? 200 : 502, result);
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器錯誤";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
