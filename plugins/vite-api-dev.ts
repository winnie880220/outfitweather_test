import "../scripts/load-env";
import { loadEnv, type Plugin, type Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import { getCurrentWeather, getWeatherProvider } from "../api/lib/weather";
import { reverseGeocode, searchLocations } from "../api/lib/geocode";
import { analyzeOutfitImage } from "../api/lib/gemini/analyze-outfit";
import { summarizeFeelFeedback } from "../api/lib/gemini/summarize-feel";
import { isGeminiConfigured } from "../api/lib/env";
import {
  getOutfitInsights,
  getRegionColorFills,
} from "../api/lib/notion/outfit-insights";
import { getMapColorPoints } from "../api/lib/notion/map-colors";
import { getRecordByPageId } from "../api/lib/notion/get-record";
import { createRecordInNotion, updateRecordInNotion } from "../api/lib/notion/records";
import {
  queryFavoritedOutfits,
  toggleOutfitFavorite,
} from "../api/lib/notion/favorites";
import { ensureActiveUserRecord } from "../api/lib/notion/user-active-record";
import type { ActiveUserRecordState } from "../api/lib/notion/user-active-record";
import { isNotionConfigured as isNotionOk } from "../api/lib/env";
import type { NotionRecordPayload } from "../api/lib/types";

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function handleApi(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction
) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return next();

  try {
    if (url.pathname === "/api/weather" && req.method === "GET") {
      const lat = parseFloat(url.searchParams.get("lat") ?? "");
      const lon = parseFloat(url.searchParams.get("lon") ?? "");
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return send(res, 400, { ok: false, error: "請提供有效的 lat、lon" });
      }
      const name = url.searchParams.get("name") ?? undefined;
      const data = await getCurrentWeather(lat, lon, name || undefined);
      return send(res, 200, {
        ok: true,
        data,
        source: "api",
        provider: getWeatherProvider(),
      });
    }

    if (url.pathname === "/api/geocode-search" && req.method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      if (q.trim().length < 2) {
        return send(res, 400, { ok: false, error: "搜尋字串至少 2 個字" });
      }
      const data = await searchLocations(q);
      return send(res, 200, { ok: true, data, source: "api" });
    }

    if (url.pathname === "/api/geocode-reverse" && req.method === "GET") {
      const lat = parseFloat(url.searchParams.get("lat") ?? "");
      const lon = parseFloat(url.searchParams.get("lon") ?? "");
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return send(res, 400, { ok: false, error: "請提供有效的 lat、lon" });
      }
      const name = await reverseGeocode(lat, lon);
      return send(res, 200, { ok: true, data: { name }, source: "api" });
    }

    if (url.pathname === "/api/analyze-outfit" && req.method === "POST") {
      if (!isGeminiConfigured()) {
        return send(res, 503, { ok: false, error: "GEMINI_API_KEY 尚未設定" });
      }
      const body = (await readBody(req)) as { imageBase64?: string; mimeType?: string };
      if (!body?.imageBase64?.trim()) {
        return send(res, 400, { ok: false, error: "缺少 imageBase64" });
      }
      const data = await analyzeOutfitImage(
        body.imageBase64,
        body.mimeType ?? "image/jpeg"
      );
      return send(res, 200, { ok: true, data, source: "gemini" });
    }

    if (url.pathname === "/api/feedback-feel-summary" && req.method === "POST") {
      const body = (await readBody(req)) as {
        breathability?: number;
        wrapping?: number;
        stuffiness?: number;
        upperBodyTags?: string[];
        lowerBodyTags?: string[];
        temp?: number;
        condition?: string;
        locationName?: string;
        userNote?: string;
      };
      if (
        body?.breathability == null ||
        body?.wrapping == null ||
        body?.stuffiness == null
      ) {
        return send(res, 400, { ok: false, error: "缺少體感數值" });
      }
      const data = await summarizeFeelFeedback({
        breathability: body.breathability,
        wrapping: body.wrapping,
        stuffiness: body.stuffiness,
        upperBodyTags: body.upperBodyTags,
        lowerBodyTags: body.lowerBodyTags,
        temp: body.temp,
        condition: body.condition,
        locationName: body.locationName,
        userNote: body.userNote,
      });
      return send(res, 200, { ok: true, data, source: "gemini" });
    }

    if (url.pathname === "/api/map-colors" && req.method === "GET") {
      if (!isNotionOk()) {
        return send(res, 503, { ok: false, error: "Notion 未設定" });
      }
      const points = await getMapColorPoints();
      return send(res, 200, { ok: true, data: { points }, source: "notion" });
    }

    if (url.pathname === "/api/outfit-insights" && req.method === "GET") {
      if (!isNotionOk()) {
        return send(res, 503, { ok: false, error: "Notion 未設定" });
      }
      const temp = parseFloat(url.searchParams.get("temp") ?? "");
      if (Number.isNaN(temp)) {
        return send(res, 400, { ok: false, error: "請提供有效的 temp" });
      }
      const delta = parseFloat(url.searchParams.get("delta") ?? "1") || 1;
      const county = url.searchParams.get("county")?.trim() || undefined;
      const district = url.searchParams.get("district")?.trim() || undefined;
      const data = await getOutfitInsights(temp, delta, county, district);
      return send(res, 200, { ok: true, data, source: "notion" });
    }

    if (url.pathname === "/api/region-color-fills" && req.method === "GET") {
      if (!isNotionOk()) {
        return send(res, 503, { ok: false, error: "Notion 未設定" });
      }
      const temp = parseFloat(url.searchParams.get("temp") ?? "");
      if (Number.isNaN(temp)) {
        return send(res, 400, { ok: false, error: "請提供有效的 temp" });
      }
      const delta = parseFloat(url.searchParams.get("delta") ?? "1") || 1;
      const fills = await getRegionColorFills(temp, delta);
      return send(res, 200, { ok: true, data: { fills }, source: "notion" });
    }

    if (url.pathname === "/api/notion-records") {
      if (req.method === "GET") {
        const pageId = url.searchParams.get("pageId")?.trim() ?? "";
        if (!pageId) {
          return send(res, 400, { ok: false, error: "缺少 pageId" });
        }
        const result = await getRecordByPageId(pageId);
        return send(res, result.ok ? 200 : 502, result);
      }
      if (req.method === "POST") {
        const body = (await readBody(req)) as NotionRecordPayload;
        const result = await createRecordInNotion(body);
        return send(res, result.ok ? 201 : 502, result);
      }
      if (req.method === "PATCH") {
        const body = (await readBody(req)) as NotionRecordPayload & { pageId?: string };
        if (!body?.pageId) {
          return send(res, 400, { ok: false, error: "缺少 pageId" });
        }
        const { pageId, ...payload } = body;
        const result = await updateRecordInNotion(pageId, payload);
        return send(res, result.ok ? 200 : 502, result);
      }
    }

    if (url.pathname === "/api/user-record/ensure") {
      if (!isNotionOk()) {
        return send(res, 503, { ok: false, error: "Notion 未設定" });
      }
      if (req.method === "POST") {
        const body = (await readBody(req)) as {
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
          return send(res, 400, { ok: false, error: "缺少 userName" });
        }
        if (typeof body.temp !== "number" || Number.isNaN(body.temp)) {
          return send(res, 400, { ok: false, error: "缺少 temp（number）" });
        }
        const result = await ensureActiveUserRecord(
          {
            userName,
            temp: body.temp,
            tempMin: typeof body.tempMin === "number" ? body.tempMin : undefined,
            tempMax: typeof body.tempMax === "number" ? body.tempMax : undefined,
            location: body.location,
            gender: body.gender as NotionRecordPayload["gender"],
            weather: body.weather,
            humidity: body.humidity,
            rainProb: body.rainProb,
            apparentTemp: body.apparentTemp,
            uvIndex: body.uvIndex,
          },
          body.activeUserRecord ?? null
        );
        return send(res, result.ok ? 200 : 502, result);
      }
    }

    if (url.pathname === "/api/favorites") {
      if (!isNotionOk()) {
        return send(res, 503, { ok: false, error: "Notion 未設定" });
      }
      if (req.method === "GET") {
        const favoriterUserName = url.searchParams.get("userName") ?? "";
        const result = await queryFavoritedOutfits(favoriterUserName);
        return send(res, result.ok ? 200 : 502, result);
      }
      if (req.method === "POST") {
        const body = (await readBody(req)) as {
          favoriterUserName?: string;
          outfitPageId?: string;
          favorited?: boolean;
          activeUserRecord?: ActiveUserRecordState | null;
          userName?: string;
          location?: string;
          gender?: string;
          temp?: number;
          weather?: string;
        };
        const favoriterUserName = (body.favoriterUserName ?? body.userName ?? "").trim();
        const outfitPageId = (body.outfitPageId ?? "").trim();
        if (!favoriterUserName) {
          return send(res, 400, { ok: false, error: "缺少 favoriterUserName（收藏者）" });
        }
        if (!outfitPageId) {
          return send(res, 400, {
            ok: false,
            error: "缺少 outfitPageId（被收藏穿搭 page id，伺服器換算 ID 欄位）",
          });
        }
        if (typeof body.favorited !== "boolean") {
          return send(res, 400, { ok: false, error: "缺少 favorited（boolean）" });
        }
        const result = await toggleOutfitFavorite({
          favoriterUserName,
          outfitPageId,
          favorited: body.favorited,
          activeRecord: body.activeUserRecord ?? null,
          profile: {
            location: body.location,
            gender: body.gender as NotionRecordPayload["gender"],
            temp: body.temp,
            weather: body.weather,
          },
        });
        return send(res, result.ok ? 200 : 502, result);
      }
    }

    return send(res, 404, { ok: false, error: "API route not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器錯誤";
    return send(res, 500, { ok: false, error: message });
  }
}

function applyLocalEnv(mode: string) {
  const loaded = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(loaded)) {
    if (value !== undefined) process.env[key] = value;
  }
}

export function viteApiDevPlugin(): Plugin {
  return {
    name: "vite-api-dev",
    configureServer(server) {
      applyLocalEnv(server.config.mode);
      server.middlewares.use(handleApi);
    },
  };
}
