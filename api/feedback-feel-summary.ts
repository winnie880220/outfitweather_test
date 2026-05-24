import {
  summarizeFeelFeedback,
  type FeelSummaryInput,
} from "./lib/gemini/summarize-feel";
import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return {};
}

/** POST /api/feedback-feel-summary — Gemini 體感評分與小結 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = (await readJsonBody(req)) as FeelSummaryInput;
    if (
      body.breathability == null ||
      body.wrapping == null ||
      body.stuffiness == null
    ) {
      return sendJson(res, 400, { ok: false, error: "缺少體感數值" });
    }

    const data = await summarizeFeelFeedback(body);
    return sendJson(res, 200, { ok: true, data, source: "gemini" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "體感評分失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
