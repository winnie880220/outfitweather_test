import type { UserGender } from "../../types/api";
import type { ActiveUserRecord } from "../session-storage";
import { apiPost } from "./client";

export type EnsureActiveUserRecordResult = ActiveUserRecord & {
  created: boolean;
};

export async function ensureActiveUserRecordApi(
  params: {
    userName: string;
    gender?: UserGender | null;
    activeUserRecord?: ActiveUserRecord | null;
    /** 為 true 時才在 Notion 建立新 active 列 */
    create?: boolean;
  }
): Promise<EnsureActiveUserRecordResult> {
  return apiPost<EnsureActiveUserRecordResult>("/api/user-record/ensure", {
    userName: params.userName.trim(),
    ...(params.gender ? { gender: params.gender } : {}),
    ...(params.activeUserRecord ? { activeUserRecord: params.activeUserRecord } : {}),
    ...(params.create ? { create: true } : {}),
  });
}
