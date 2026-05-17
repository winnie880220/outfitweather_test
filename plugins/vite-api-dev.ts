import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import type { Plugin, Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import { getCurrentWeather } from "../api/lib/weather";
import { reverseGeocode, searchLocations } from "../api/lib/geocode";
import { createRecordInNotion, updateRecordInNotion } from "../api/lib/notion/records";
import type { NotionRecordPayload } from "../api/lib/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

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

    if (url.pathname === "/api/notion-records") {
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

    return send(res, 404, { ok: false, error: "API route not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "伺服器錯誤";
    return send(res, 500, { ok: false, error: message });
  }
}

export function viteApiDevPlugin(): Plugin {
  return {
    name: "vite-api-dev",
    configureServer(server) {
      server.middlewares.use(handleApi);
    },
  };
}
