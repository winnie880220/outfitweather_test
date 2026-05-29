import type { MapDataRegion } from "./api/map-colors";
import type { RegionColorFill } from "./api/region-color-fills";

const CACHE_KEY = "ow-map-bootstrap-v3";
const CACHE_SCHEMA_KEY = "ow-map-cache-schema";
/** 部署新填色邏輯時遞增，會自動清除舊 session 快取 */
const CACHE_SCHEMA = "2026-05-29-fill-stable";

const LEGACY_CACHE_KEYS = ["ow-map-data-regions-v1", "ow-map-bootstrap-v2"];

const TTL_MS = 10 * 60 * 1000;

export type MapBootstrapCache = {
  at: number;
  regions: MapDataRegion[];
  fills: RegionColorFill[];
  /** 填色時使用的體感溫度區間標記，例如 "26@d1" */
  fillTempKey: string;
};

/** 清除地圖區域／填色 session 快取（含舊版 key） */
export function clearMapBootstrapCache(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    for (const key of [CACHE_KEY, ...LEGACY_CACHE_KEYS]) {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * 版本變更時自動清一次快取，避免舊填色殘留。
 * 進 App 呼叫一次即可。
 */
export function ensureMapCacheSchema(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (sessionStorage.getItem(CACHE_SCHEMA_KEY) === CACHE_SCHEMA) return;
    clearMapBootstrapCache();
    sessionStorage.setItem(CACHE_SCHEMA_KEY, CACHE_SCHEMA);
  } catch {
    /* quota */
  }
}

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
