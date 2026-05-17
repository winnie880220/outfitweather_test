import { analyzeOutfitImage } from "./lib/gemini/analyze-outfit";
import { isGeminiConfigured } from "./lib/env";
import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return {};
}

/** POST /api/analyze-outfit — Gemini 辨識上著／下著標籤 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!isGeminiConfigured()) {
    return sendJson(res, 503, {
      ok: false,
      error: "GEMINI_API_KEY 尚未在 Vercel 設定",
    });
  }

  try {
    const body = (await readJsonBody(req)) as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!body?.imageBase64?.trim()) {
      return sendJson(res, 400, { ok: false, error: "缺少 imageBase64" });
    }

    const data = await analyzeOutfitImage(
      body.imageBase64,
      body.mimeType ?? "image/jpeg"
    );

    return sendJson(res, 200, { ok: true, data, source: "gemini" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "穿搭分析失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
