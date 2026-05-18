import type { UserGender } from "../../types/api";
import type { ActiveUserRecord } from "../session-storage";
import { apiPost } from "./client";

export type EnsureActiveUserRecordResult = ActiveUserRecord & {
  created: boolean;
};

export async function ensureActiveUserRecordApi(
  params: {
    userName: string;
    temp: number;
    tempMin?: number;
    tempMax?: number;
    location?: string;
    gender?: UserGender | null;
    weather?: string;
    humidity?: number;
    rainProb?: number;
    apparentTemp?: number;
    uvIndex?: number;
    activeUserRecord?: ActiveUserRecord | null;
  }
): Promise<EnsureActiveUserRecordResult> {
  return apiPost<EnsureActiveUserRecordResult>("/api/user-record/ensure", {
    userName: params.userName.trim(),
    temp: params.temp,
    ...(typeof params.tempMin === "number" ? { tempMin: params.tempMin } : {}),
    ...(typeof params.tempMax === "number" ? { tempMax: params.tempMax } : {}),
    ...(params.location ? { location: params.location } : {}),
    ...(params.gender ? { gender: params.gender } : {}),
    ...(params.weather ? { weather: params.weather } : {}),
    ...(typeof params.humidity === "number" ? { humidity: params.humidity } : {}),
    ...(typeof params.rainProb === "number" ? { rainProb: params.rainProb } : {}),
    ...(typeof params.apparentTemp === "number"
      ? { apparentTemp: params.apparentTemp }
      : {}),
    ...(typeof params.uvIndex === "number" ? { uvIndex: params.uvIndex } : {}),
    ...(params.activeUserRecord ? { activeUserRecord: params.activeUserRecord } : {}),
  });
}
