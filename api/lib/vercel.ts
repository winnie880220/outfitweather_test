import type { VercelRequest, VercelResponse } from "@vercel/node";

export type { VercelRequest, VercelResponse };

export function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

export function getQueryString(
  query: VercelRequest["query"],
  key: string
): string {
  const v = query[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function parseLatLonFromQuery(query: VercelRequest["query"]) {
  const lat = parseFloat(getQueryString(query, "lat"));
  const lon = parseFloat(getQueryString(query, "lon"));
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}
