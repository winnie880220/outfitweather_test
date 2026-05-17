import type { ApiResponse } from "./types";

export function jsonResponse<T>(status: number, body: ApiResponse<T>): Response {
  return Response.json(body, { status });
}

export function parseLatLon(url: URL): { lat: number; lon: number } | null {
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lon = parseFloat(url.searchParams.get("lon") ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}
