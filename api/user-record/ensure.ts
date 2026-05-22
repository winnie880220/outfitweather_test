import { ensureActiveUserRecord } from "../lib/notion/user-active-record";
import type { ActiveUserRecordState } from "../lib/notion/user-active-record";
import { sendJson, type VercelRequest, type VercelResponse } from "../lib/vercel";

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return {};
}

/** POST /api/user-record/ensure — 取得或建立當日＋氣溫區間的 active 列 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    }

    const body = (await readJsonBody(req)) as {
      userName?: string;
      temp?: number;
      tempMin?: number;
      tempMax?: number;
      location?: string;
      gender?: string;
      weather?: string;
      humidity?: number;
      rainProb?: number;
      apparentTemp?: number;
      uvIndex?: number;
      activeUserRecord?: ActiveUserRecordState | null;
    };

    const userName = (body.userName ?? "").trim();
    if (!userName) {
      return sendJson(res, 400, { ok: false, error: "缺少 userName" });
    }
    if (typeof body.temp !== "number" || Number.isNaN(body.temp)) {
      return sendJson(res, 400, { ok: false, error: "缺少 temp（number）" });
    }

    const result = await ensureActiveUserRecord(
      {
        userName,
        temp: body.temp,
        tempMin: typeof body.tempMin === "number" ? body.tempMin : undefined,
        tempMax: typeof body.tempMax === "number" ? body.tempMax : undefined,
        location: typeof body.location === "string" ? body.location : undefined,
        gender:
          body.gender === "男生" ||
          body.gender === "女生" ||
          body.gender === "不分"
            ? body.gender
            : undefined,
        weather: typeof body.weather === "string" ? body.weather : undefined,
        humidity:
          typeof body.humidity === "number" ? body.humidity : undefined,
        rainProb: typeof body.rainProb === "number" ? body.rainProb : undefined,
        apparentTemp:
          typeof body.apparentTemp === "number" ? body.apparentTemp : undefined,
        uvIndex: typeof body.uvIndex === "number" ? body.uvIndex : undefined,
      },
      body.activeUserRecord ?? null
    );

    return sendJson(res, result.ok ? 200 : 502, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器錯誤";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
