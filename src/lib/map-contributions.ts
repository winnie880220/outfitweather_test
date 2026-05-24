import { limitOutfitColors, MAX_OUTFIT_COLORS } from "../../lib/outfit-colors";
import { colorNameToHex } from "./color-lexicon";
import { loadSession, saveSession } from "./session-storage";

export interface MapContributionEntry {
  id: string;
  /** 區域級座標（約 1 km 精度） */
  lat: number;
  lon: number;
  colors: string[];
  addedAt: string;
}

export interface MapColorBubble {
  id: string;
  colorName: string;
  hex: string;
  lat: number;
  lon: number;
}

/** 台灣範圍（含離島顯示區），供 Leaflet maxBounds */
export const TAIWAN_MAP_BOUNDS: [[number, number], [number, number]] = [
  [21.7, 118.2],
  [26.4, 122.3],
];

export const TAIWAN_MAP_CENTER: [number, number] = [23.7, 121.0];

/** 隱私：座標四捨五入至約 1 km */
export function privacyRoundCoord(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function loadMapContributions(): MapContributionEntry[] {
  return loadSession().mapContributions ?? [];
}

export function addMapContribution(
  lat: number,
  lon: number,
  colors: string[],
  options?: { id?: string }
): MapContributionEntry | null {
  const unique = limitOutfitColors(colors);
  if (unique.length === 0) return null;

  const prev = loadMapContributions();
  const entryId = options?.id?.trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const existing = prev.find((e) => e.id === entryId);
  if (existing) return existing;

  const entry: MapContributionEntry = {
    id: entryId,
    lat: privacyRoundCoord(lat),
    lon: privacyRoundCoord(lon),
    colors: unique,
    addedAt: new Date().toISOString(),
  };

  saveSession({ mapContributions: [...prev, entry] });
  return entry;
}

/** 將每次上傳展開為地圖色票泡（同一次上傳略為散開避免重疊） */
export function flattenMapBubbles(entries: MapContributionEntry[]): MapColorBubble[] {
  const bubbles: MapColorBubble[] = [];

  for (const entry of entries) {
    const colors = entry.colors.slice(0, MAX_OUTFIT_COLORS);
    const n = colors.length;
    colors.forEach((colorName, index) => {
      const angle = (index / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = n > 1 ? 0.012 + index * 0.003 : 0;
      bubbles.push({
        id: `${entry.id}-${index}`,
        colorName,
        hex: colorNameToHex(colorName),
        lat: entry.lat + Math.sin(angle) * radius,
        lon: entry.lon + Math.cos(angle) * radius,
      });
    });
  }

  return bubbles;
}
