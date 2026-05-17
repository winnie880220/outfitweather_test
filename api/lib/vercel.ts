/** Vercel Node.js Serverless 最小型別（避免依賴 @vercel/node） */
export type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

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
