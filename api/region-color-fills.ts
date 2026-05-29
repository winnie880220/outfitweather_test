import {
  getRegionColorFills,
  getRegionColorFillsForLocales,
} from "./lib/notion/outfit-insights";
import type { MapFillLocaleSpec } from "../lib/map-fill-locales";
import { isNotionConfigured } from "./lib/env";
import { getQueryString, sendJson, type VercelRequest, type VercelResponse } from "./lib/vercel";

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return {};
}

function parseLocales(body: unknown): MapFillLocaleSpec[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { locales?: unknown }).locales;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const locales: MapFillLocaleSpec[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const county = typeof row.county === "string" ? row.county.trim() : "";
    const regionKey =
      typeof row.regionKey === "string" ? row.regionKey.trim() : county;
    const refTemp =
      typeof row.refTemp === "number"
        ? row.refTemp
        : parseFloat(String(row.refTemp ?? ""));
    const airTemp =
      typeof row.airTemp === "number"
        ? row.airTemp
        : parseFloat(String(row.airTemp ?? refTemp));
    const delta =
      typeof row.delta === "number"
        ? row.delta
        : parseFloat(String(row.delta ?? "1"));
    if (!county || Number.isNaN(refTemp)) continue;

    locales.push({
      regionKey,
      county: county as MapFillLocaleSpec["county"],
      ...(typeof row.district === "string" && row.district.trim()
        ? { district: row.district.trim() as MapFillLocaleSpec["district"] }
        : {}),
      refTemp,
      airTemp: Number.isNaN(airTemp) ? refTemp : airTemp,
      delta: Number.isNaN(delta) ? 1 : Math.min(3, Math.max(0, delta)),
    });
  }

  return locales.length > 0 ? locales : null;
}

/** GET 單一溫度（相容）| POST { locales } 各地體感溫度 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isNotionConfigured()) {
    return sendJson(res, 503, {
      ok: false,
      error: "NOTION_API_KEY 或 NOTION_DATABASE_ID 尚未設定",
    });
  }

  if (req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const locales = parseLocales(body);
      if (!locales) {
        return sendJson(res, 400, {
          ok: false,
          error: "請提供 locales 陣列（含 county、refTemp、airTemp、delta）",
        });
      }
      const fills = await getRegionColorFillsForLocales(locales);
      return sendJson(res, 200, { ok: true, data: { fills }, source: "notion" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "區域色票失敗";
      return sendJson(res, 500, { ok: false, error: message });
    }
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const tempRaw = getQueryString(req.query, "temp");
  const temp = parseFloat(tempRaw);
  if (Number.isNaN(temp)) {
    return sendJson(res, 400, { ok: false, error: "請提供有效的 temp 參數" });
  }

  const deltaRaw = getQueryString(req.query, "delta");
  const delta = deltaRaw ? parseFloat(deltaRaw) : 1;
  const safeDelta = Number.isNaN(delta) ? 1 : Math.min(3, Math.max(0, delta));

  const airTempRaw = getQueryString(req.query, "airTemp");
  const airTempParsed = airTempRaw ? parseFloat(airTempRaw) : Number.NaN;
  const fallbackTemp = Number.isNaN(airTempParsed) ? undefined : airTempParsed;

  try {
    const fills = await getRegionColorFills(temp, safeDelta, { fallbackTemp });
    return sendJson(res, 200, { ok: true, data: { fills }, source: "notion" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "區域色票失敗";
    return sendJson(res, 500, { ok: false, error: message });
  }
}
