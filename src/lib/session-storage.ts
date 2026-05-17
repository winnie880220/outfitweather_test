import type { UserLocation } from "../types/api";

const STORAGE_KEY = "outfitweather_session";

export interface PendingRecordSnapshot {
  photoPreviewUrl?: string;
  locationName?: string;
  temp?: number;
  condition?: string;
  recordedTime?: string;
}

export interface PendingRecord {
  pageId: string;
  date: string;
  photoSavedAt: string;
  hasFeedback: boolean;
  photoPreviewUrl?: string;
  locationName?: string;
  temp?: number;
  condition?: string;
  recordedTime?: string;
}

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface AppSession {
  userName: string;
  userLocation: UserLocation | null;
  pendingRecord: PendingRecord | null;
  reminder: ReminderSettings;
}

export const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  hour: 20,
  minute: 0,
};

const EMPTY_SESSION: AppSession = {
  userName: "",
  userLocation: null,
  pendingRecord: null,
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
      userLocation: parsed.userLocation ?? null,
      pendingRecord: parsed.pendingRecord ?? null,
      reminder: {
        ...DEFAULT_REMINDER,
        ...(parsed.reminder ?? {}),
      },
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
  saveSession({ pendingRecord: pending });
  return pending;
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
