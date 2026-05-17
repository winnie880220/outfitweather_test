import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { CreateFeedbackPayload } from "../../src/types/api";
import { methodNotAllowed, sendJson } from "../../lib/server/http";
import { createFeedbackInNotion } from "../../lib/server/notion/feedback";

/**
 * POST /api/notion/feedback
 * 體感回饋寫入 Notion Database
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const body = req.body as CreateFeedbackPayload | undefined;
  if (!body?.userName || !body?.description) {
    return sendJson(res, 400, { ok: false, error: "缺少 userName 或 description" });
  }

  const result = await createFeedbackInNotion(body);
  return sendJson(res, result.ok ? 201 : 501, result);
}
