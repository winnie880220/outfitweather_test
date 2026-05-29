import type { MapContributionEntry } from "./map-contributions";
import type { UserGender, UserLocation } from "../types/api";
import { clearAllInspirationFavoritesLocal } from "./inspiration-favorites";
import { clearInspirationSwipe } from "./inspiration-swipe";
import { isUserGender } from "./user-gender";

const STORAGE_KEY = "outfitweather_session";

export interface PendingRecordSnapshot {
  photoPreviewUrl?: string;
  /** 分享卡下載用，固定 data URL（避免 blob 失效） */
  photoDataUrl?: string;
  locationName?: string;
  temp?: number;
  condition?: string;
  recordedTime?: string;
  upperBodyTags?: string[];
  lowerBodyTags?: string[];
  colors?: string[];
  tagAnchors?: Array<{ label: string; anchorX: number; anchorY: number }>;
}

export interface PendingRecord {
  pageId: string;
  date: string;
  photoSavedAt: string;
  hasFeedback: boolean;
  photoPreviewUrl?: string;
  photoDataUrl?: string;
  locationName?: string;
  temp?: number;
  condition?: string;
  recordedTime?: string;
  upperBodyTags?: string[];
  lowerBodyTags?: string[];
  colors?: string[];
  tagAnchors?: Array<{ label: string; anchorX: number; anchorY: number }>;
}

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

/** 當日＋體感溫度區間的 active Notion 列（收藏／記錄／回饋寫入此列） */
export interface ActiveUserRecord {
  pageId: string;
  date: string;
  tempBand: number;
}

export interface AppSession {
  userName: string;
  gender: UserGender | null;
  userLocation: UserLocation | null;
  pendingRecord: PendingRecord | null;
  activeUserRecord: ActiveUserRecord | null;
  reminder: ReminderSettings;
  /** 首頁地圖：使用者上傳穿搭後累積的色票貢獻 */
  mapContributions?: MapContributionEntry[];
}

export const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  hour: 20,
  minute: 0,
};

const EMPTY_SESSION: AppSession = {
  userName: "",
  gender: null,
  userLocation: null,
  pendingRecord: null,
  activeUserRecord: null,
  reminder: DEFAULT_REMINDER,
};

export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadSession(): AppSession {
  if (typeof window === "undefined") return { ...EMPTY_SESSION };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_SESSION };
    const parsed = JSON.parse(raw) as Partial<AppSession>;
    return {
      userName: typeof parsed.userName === "string" ? parsed.userName : "",
      gender:
        typeof parsed.gender === "string" && isUserGender(parsed.gender)
          ? parsed.gender
          : null,
      userLocation: parsed.userLocation ?? null,
      pendingRecord: parsed.pendingRecord ?? null,
      activeUserRecord:
        parsed.activeUserRecord &&
        typeof parsed.activeUserRecord.pageId === "string" &&
        typeof parsed.activeUserRecord.date === "string" &&
        typeof parsed.activeUserRecord.tempBand === "number"
          ? parsed.activeUserRecord
          : null,
      reminder: {
        ...DEFAULT_REMINDER,
        ...(parsed.reminder ?? {}),
      },
      mapContributions: Array.isArray(parsed.mapContributions)
        ? parsed.mapContributions.filter(
            (e): e is MapContributionEntry =>
              !!e &&
              typeof e === "object" &&
              typeof (e as MapContributionEntry).id === "string" &&
              typeof (e as MapContributionEntry).lat === "number" &&
              typeof (e as MapContributionEntry).lon === "number" &&
              Array.isArray((e as MapContributionEntry).colors)
          )
        : [],
    };
  } catch {
    return { ...EMPTY_SESSION };
  }
}

export function saveSession(partial: Partial<AppSession>): AppSession {
  const next = { ...loadSession(), ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("session-storage save failed:", e);
  }
  return next;
}

export function isPendingValidToday(pending: PendingRecord | null): boolean {
  if (!pending || pending.hasFeedback) return false;
  return pending.date === localDateString();
}

function writePendingRecord(pending: PendingRecord): PendingRecord {
  const base = loadSession();
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...base, pendingRecord: pending })
    );
    return pending;
  } catch (e) {
    if (!pending.photoPreviewUrl) throw e;
    const lean: PendingRecord = { ...pending };
    delete lean.photoPreviewUrl;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...base, pendingRecord: lean })
    );
    console.warn("pending photo preview too large for localStorage, will restore from Notion");
    return lean;
  }
}

export function setPendingRecord(
  pageId: string,
  snapshot?: PendingRecordSnapshot
): PendingRecord {
  const pending: PendingRecord = {
    pageId,
    date: localDateString(),
    photoSavedAt: new Date().toISOString(),
    hasFeedback: false,
    ...snapshot,
  };
  return writePendingRecord(pending);
}

export function formatTimeFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function markPendingFeedbackComplete(): void {
  const session = loadSession();
  if (!session.pendingRecord) return;
  saveSession({
    pendingRecord: { ...session.pendingRecord, hasFeedback: true },
  });
}

export function clearPendingRecord(): void {
  saveSession({ pendingRecord: null });
}

/** 回到初始頁：清除 session、待回饋、收藏快取、靈感滑動紀錄等所有本機資料 */
export function resetAppSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearAllInspirationFavoritesLocal();
    clearInspirationSwipe();
  } catch (e) {
    console.warn("session-storage reset failed:", e);
  }
}

export function expireStalePending(): boolean {
  const session = loadSession();
  if (!session.pendingRecord) return false;
  if (session.pendingRecord.hasFeedback) {
    clearPendingRecord();
    return false;
  }
  if (session.pendingRecord.date !== localDateString()) {
    clearPendingRecord();
    return true;
  }
  return false;
}
