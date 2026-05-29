import type { UserGender } from "../../types/api";
import { apiGet } from "./client";

export type OutfitTagStat = {
  name: string;
  count: number;
  percent: number;
  emoji: string;
  hex?: string;
};

export type InspirationItem = {
  id: string;
  recordId?: string;
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
  colors: string[];
  humidity: string;
  location: string;
  photoUrl?: string;
  gender?: UserGender;
  /** 溫區篩選用（體感優先，與 Notion 紀錄一致） */
  referenceTemp?: number;
};

export type OutfitInsights = {
  targetTemp: number;
  tempMin: number;
  tempMax: number;
  sampleCount: number;
  /** 含可展示照片的紀錄數（≤ sampleCount） */
  photoCount?: number;
  upperTop3: OutfitTagStat[];
  lowerTop3: OutfitTagStat[];
  colorTop3: OutfitTagStat[];
  inspiration: InspirationItem[];
};

/** GET /api/outfit-insights?temp=26&delta=1（temp 為體感溫度參考值） */
export async function fetchOutfitInsights(
  temp: number,
  delta = 1,
  county?: string,
  district?: string
): Promise<OutfitInsights> {
  const params = new URLSearchParams({
    temp: String(Math.round(temp)),
    delta: String(delta),
  });
  if (county?.trim()) params.set("county", county.trim());
  if (district?.trim()) params.set("district", district.trim());
  return apiGet<OutfitInsights>(`/api/outfit-insights?${params}`);
}
