import { ensureActiveUserRecord } from "../lib/notion/user-active-record";
import type { ActiveUserRecordState } from "../lib/notion/user-active-record";
import type { UserGender } from "../lib/types";
import { sendJson, type VercelRequest, type VercelResponse } from "../lib/vercel";

function parseUserGender(value: unknown): UserGender | undefined {
  if (value === "男生" || value === "女生" || value === "不分") return value;
  return undefined;
}

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return {};
}

/** POST /api/user-record/ensure — 取得或建立台灣當日收藏容器列 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    }

    const body = (await readJsonBody(req)) as {
      userName?: string;
      gender?: string;
      activeUserRecord?: ActiveUserRecordState | null;
      /** 預設 false：僅查詢既有 active 列，不自動 POST 新列 */
      create?: boolean;
    };

    const userName = (body.userName ?? "").trim();
    if (!userName) {
      return sendJson(res, 400, { ok: false, error: "缺少 userName" });
    }

    const gender = parseUserGender(body.gender);
    const result = await ensureActiveUserRecord(
      { userName, ...(gender ? { gender } : {}) },
      body.activeUserRecord ?? null,
      { createIfMissing: body.create === true }
    );

    return sendJson(res, result.ok ? 200 : 502, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器錯誤";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
