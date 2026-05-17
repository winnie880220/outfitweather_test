import type { NotionRecordPayload } from "./lib/types";
import { edgeConfig, jsonResponse } from "./lib/edge";
import { createRecordInNotion, updateRecordInNotion } from "./lib/notion/records";

export const config = edgeConfig;

/** POST /api/notion-records | PATCH /api/notion-records */
export default async function handler(request: Request) {
  try {
    if (request.method === "POST") {
      const body = (await request.json()) as NotionRecordPayload;
      if (!body?.userName?.trim()) {
        return jsonResponse(400, { ok: false, error: "缺少 userName" });
      }
      const result = await createRecordInNotion(body);
      return jsonResponse(result.ok ? 201 : 502, result);
    }

    if (request.method === "PATCH") {
      const body = (await request.json()) as NotionRecordPayload & { pageId?: string };
      if (!body?.pageId) {
        return jsonResponse(400, { ok: false, error: "缺少 pageId" });
      }
      const { pageId, ...payload } = body;
      const result = await updateRecordInNotion(pageId, payload);
      return jsonResponse(result.ok ? 200 : 502, result);
    }

    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器錯誤";
    return jsonResponse(500, { ok: false, error: message });
  }
}
