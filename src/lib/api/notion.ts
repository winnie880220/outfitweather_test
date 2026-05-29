import type {
  ApiResponse,
  NotionRecordPayload,
  OutfitRecord,
  UserGender,
} from "../../types/api";
import { ApiError, apiGet, apiPatch } from "./client";

export type OutfitRecordSnapshot = {
  pageId: string;
  photoUrl?: string;
  locationName?: string;
  temp?: number;
  weather?: string;
  recordedTime?: string;
};

/** GET /api/notion-records?pageId= */
export async function fetchRecordSnapshot(
  pageId: string
): Promise<OutfitRecordSnapshot> {
  const params = new URLSearchParams({ pageId: pageId.trim() });
  return apiGet<OutfitRecordSnapshot>(`/api/notion-records?${params}`);
}

/** POST /api/notion-records — 建立新穿搭列（含照片上傳） */
export async function createRecord(
  payload: NotionRecordPayload
): Promise<{ id: string; photoWarning?: string }> {
  const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const res = await fetch(`${API_BASE}/api/notion-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ApiResponse<{ id: string }>;
  if (!res.ok || !json.ok || !json.data?.id) {
    throw new ApiError(json.error ?? `建立紀錄失敗 (${res.status})`, res.status);
  }
  return {
    id: json.data.id,
    ...(json.error ? { photoWarning: json.error } : {}),
  };
}

/** PATCH /api/notion/records — 更新體感等欄位 */
export async function updateRecord(
  pageId: string,
  payload: NotionRecordPayload
): Promise<{ id: string }> {
  return apiPatch<{ id: string }>("/api/notion-records", { pageId, ...payload });
}

/** 從天氣資料組 Notion 欄位 */
export function buildRecordFromWeather(
  userName: string,
  weather: {
    locationName: string;
    temp: number;
    tempMin?: number;
    tempMax?: number;
    condition: string;
    humidity: number;
    rainProb: number;
    apparentTemp: number;
    uvIndex: number;
  },
  startedAt?: string,
  gender?: UserGender
): NotionRecordPayload {
  return {
    userName,
    ...(gender ? { gender } : {}),
    location: weather.locationName,
    startedAt: startedAt ?? new Date().toISOString(),
    weather: weather.condition,
    temperature: Math.round(weather.temp),
    ...(typeof weather.tempMax === "number" && !Number.isNaN(weather.tempMax)
      ? { maxTemp: Math.round(weather.tempMax) }
      : {}),
    ...(typeof weather.tempMin === "number" && !Number.isNaN(weather.tempMin)
      ? { minTemp: Math.round(weather.tempMin) }
      : {}),
    apparentTemp: Math.round(weather.apparentTemp),
    humidity: weather.humidity,
    rainProb: weather.rainProb,
    uvIndex: Math.round(weather.uvIndex),
  };
}

/** @deprecated 改用 createRecord */
export const createOutfit = createRecord;

/** @deprecated 改用 updateRecord */
export async function createFeedback(payload: {
  userName: string;
  description: string;
  breathability: number;
  snugness: number;
  stuffiness: number;
  weatherSnapshot?: Partial<{
    locationName: string;
    temp: number;
    condition: string;
    humidity: number;
    rainProb: number;
    apparentTemp: number;
    uvIndex: number;
  }>;
}): Promise<{ id: string }> {
  return createRecord({
    userName: payload.userName,
    breathability: payload.breathability,
    wrapping: payload.snugness,
    stuffiness: payload.stuffiness,
    ...(payload.weatherSnapshot && {
      location: payload.weatherSnapshot.locationName,
      temperature: payload.weatherSnapshot.temp
        ? Math.round(payload.weatherSnapshot.temp)
        : undefined,
      weather: payload.weatherSnapshot.condition,
      humidity: payload.weatherSnapshot.humidity,
      rainProb: payload.weatherSnapshot.rainProb,
      apparentTemp:
        payload.weatherSnapshot.apparentTemp != null
          ? Math.round(payload.weatherSnapshot.apparentTemp)
          : undefined,
      uvIndex: payload.weatherSnapshot.uvIndex
        ? Math.round(payload.weatherSnapshot.uvIndex)
        : undefined,
    }),
  });
}

/** @deprecated 尚未實作從 Notion 讀取列表 */
export async function listOutfits(): Promise<OutfitRecord[]> {
  return [];
}

export const listInspiration = listOutfits;
