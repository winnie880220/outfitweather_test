import type { Plugin, Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import { getCurrentWeather } from "../lib/server/weather";
import { reverseGeocode, searchLocations } from "../lib/server/geocode";
import { createOutfitInNotion, listOutfitsFromNotion } from "../lib/server/notion/outfits";
import { createFeedbackInNotion } from "../lib/server/notion/feedback";
import { listInspirationFromNotion } from "../lib/server/notion/inspiration";

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
      return send(res, 200, { ok: true, data, source: "api" });
    }

    if (url.pathname === "/api/geocode/search" && req.method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      if (q.trim().length < 2) {
        return send(res, 400, { ok: false, error: "搜尋字串至少 2 個字" });
      }
      const data = await searchLocations(q);
      return send(res, 200, { ok: true, data, source: "api" });
    }

    if (url.pathname === "/api/geocode/reverse" && req.method === "GET") {
      const lat = parseFloat(url.searchParams.get("lat") ?? "");
      const lon = parseFloat(url.searchParams.get("lon") ?? "");
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return send(res, 400, { ok: false, error: "請提供有效的 lat、lon" });
      }
      const name = await reverseGeocode(lat, lon);
      return send(res, 200, { ok: true, data: { name }, source: "api" });
    }

    if (url.pathname === "/api/notion/outfits") {
      if (req.method === "GET") {
        const result = await listOutfitsFromNotion();
        return send(res, result.ok ? 200 : 501, result);
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const result = await createOutfitInNotion(body as Parameters<typeof createOutfitInNotion>[0]);
        return send(res, result.ok ? 201 : 501, result);
      }
    }

    if (url.pathname === "/api/notion/feedback" && req.method === "POST") {
      const body = await readBody(req);
      const result = await createFeedbackInNotion(body as Parameters<typeof createFeedbackInNotion>[0]);
      return send(res, result.ok ? 201 : 501, result);
    }

    if (url.pathname === "/api/notion/inspiration" && req.method === "GET") {
      const result = await listInspirationFromNotion();
      return send(res, result.ok ? 200 : 501, result);
    }

    return send(res, 404, { ok: false, error: "API route not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器錯誤";
    return send(res, 500, { ok: false, error: message });
  }
}

/** 本機 pnpm dev 時模擬 Vercel /api 路由 */
export function viteApiDevPlugin(): Plugin {
  return {
    name: "vite-api-dev",
    configureServer(server) {
      server.middlewares.use(handleApi);
    },
  };
}
