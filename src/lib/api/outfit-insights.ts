import { apiGet } from "./client";

export type OutfitTagStat = {
  name: string;
  count: number;
  percent: number;
  emoji: string;
};

export type InspirationItem = {
  id: string;
  emoji: string;
  bg: string;
  match: string;
  temp: string;
  who: string;
  date: string;
  feelMetrics: {
    breathability?: number;
    wrapping?: number;
    stuffiness?: number;
  };
  tags: string[];
  humidity: string;
  location: string;
  photoUrl?: string;
};

export type OutfitInsights = {
  targetTemp: number;
  tempMin: number;
  tempMax: number;
  sampleCount: number;
  upperTop3: OutfitTagStat[];
  lowerTop3: OutfitTagStat[];
  inspiration: InspirationItem[];
};

/** GET /api/outfit-insights?temp=26&delta=1 */
export async function fetchOutfitInsights(
  temp: number,
  delta = 1
): Promise<OutfitInsights> {
  const params = new URLSearchParams({
    temp: String(Math.round(temp)),
    delta: String(delta),
  });
  return apiGet<OutfitInsights>(`/api/outfit-insights?${params}`);
}
