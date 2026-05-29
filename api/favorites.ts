import {
  queryFavoritedOutfits,
  toggleOutfitFavorite,
} from "./lib/notion/favorites";
import type { ActiveUserRecordState } from "./lib/notion/user-active-record";
import { sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return {};
}

/** GET /api/favorites?userName=收藏者 | POST /api/favorites */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      const favoriterUserName =
        typeof req.query.userName === "string" ? req.query.userName : "";
      const result = await queryFavoritedOutfits(favoriterUserName);
      return sendJson(res, result.ok ? 200 : 502, result);
    }

    if (req.method === "POST") {
      const body = (await readJsonBody(req)) as {
        favoriterUserName?: string;
        outfitPageId?: string;
        favorited?: boolean;
        activeUserRecord?: ActiveUserRecordState | null;
        location?: string;
        gender?: string;
        temp?: number;
        apparentTemp?: number;
        weather?: string;
        /** @deprecated */
        userName?: string;
        targetUserName?: string;
        favoriterPageId?: string;
      };

      const favoriterUserName = (body.favoriterUserName ?? body.userName ?? "").trim();
      const outfitPageId = (body.outfitPageId ?? "").trim();

      if (!favoriterUserName) {
        return sendJson(res, 400, { ok: false, error: "缺少 favoriterUserName（收藏者）" });
      }
      if (!outfitPageId) {
        return sendJson(res, 400, {
          ok: false,
          error: "缺少 outfitPageId（被收藏穿搭的 Notion page id，伺服器會換算成 ID 欄位）",
        });
      }
      if (typeof body.favorited !== "boolean") {
        return sendJson(res, 400, { ok: false, error: "缺少 favorited（boolean）" });
      }

      const result = await toggleOutfitFavorite({
        favoriterUserName,
        outfitPageId,
        favorited: body.favorited,
        activeRecord: body.activeUserRecord ?? null,
        profile: {
          location:
            typeof body.location === "string" ? body.location : undefined,
          gender:
            body.gender === "男生" ||
            body.gender === "女生" ||
            body.gender === "不分"
              ? body.gender
              : undefined,
          temp: typeof body.temp === "number" ? body.temp : undefined,
          apparentTemp:
            typeof body.apparentTemp === "number" ? body.apparentTemp : undefined,
          weather: typeof body.weather === "string" ? body.weather : undefined,
        },
      });
      return sendJson(res, result.ok ? 200 : 502, result);
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器錯誤";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
