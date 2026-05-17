import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ApiResponse } from "../../src/types/api";

export function sendJson<T>(res: VercelResponse, status: number, body: ApiResponse<T>) {
  res.status(status).json(body);
}

export function methodNotAllowed(res: VercelResponse) {
  sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

export function badRequest(res: VercelResponse, message: string) {
  sendJson(res, 400, { ok: false, error: message });
}

export function parseLatLon(req: VercelRequest): { lat: number; lon: number } | null {
  const lat = parseFloat(String(req.query.lat ?? ""));
  const lon = parseFloat(String(req.query.lon ?? ""));
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}
