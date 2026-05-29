import type { MapDataRegion } from "./api/map-colors";
import type { RegionColorFill } from "./api/region-color-fills";

const CACHE_KEY = "ow-map-bootstrap-v2";
const TTL_MS = 10 * 60 * 1000;

export type MapBootstrapCache = {
  at: number;
  regions: MapDataRegion[];
  fills: RegionColorFill[];
  /** 填色時使用的體感溫度區間標記，例如 "26@d1" */
  fillTempKey: string;
};

export function readMapBootstrapCache(): MapBootstrapCache | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MapBootstrapCache;
    if (
      !Array.isArray(parsed.regions) ||
      !Array.isArray(parsed.fills) ||
      Date.now() - parsed.at > TTL_MS
    ) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** @deprecated 請改用 readMapBootstrapCache */
export function readMapDataRegionsCache(): MapDataRegion[] | null {
  return readMapBootstrapCache()?.regions ?? null;
}

export function writeMapBootstrapCache(
  regions: MapDataRegion[],
  fills: RegionColorFill[],
  fillTempKey: string
): void {
  if (typeof sessionStorage === "undefined" || regions.length === 0) return;
  try {
    const payload: MapBootstrapCache = {
      at: Date.now(),
      regions,
      fills,
      fillTempKey,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

/** @deprecated 請改用 writeMapBootstrapCache */
export function writeMapDataRegionsCache(regions: MapDataRegion[]): void {
  if (regions.length === 0) return;
  writeMapBootstrapCache(regions, [], "");
}
