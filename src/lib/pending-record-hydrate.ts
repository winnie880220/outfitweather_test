import { fetchRecordSnapshot } from "./api/notion";
import {
  isPendingValidToday,
  loadSession,
  saveSession,
  type PendingRecord,
} from "./session-storage";

/** 從 Notion 補齊待回饋紀錄的快照（localStorage 無預覽圖或 URL 過期時） */
export async function hydratePendingRecordFromNotion(): Promise<boolean> {
  const session = loadSession();
  const pending = session.pendingRecord;
  if (!isPendingValidToday(pending)) return false;

  const hasLocalPreview =
    typeof pending.photoPreviewUrl === "string" &&
    pending.photoPreviewUrl.startsWith("data:");

  if (hasLocalPreview) return false;

  try {
    const snap = await fetchRecordSnapshot(pending.pageId);
    const next: PendingRecord = {
      ...pending,
      ...(snap.photoUrl ? { photoPreviewUrl: snap.photoUrl } : {}),
      ...(snap.locationName ? { locationName: snap.locationName } : {}),
      ...(typeof snap.temp === "number" ? { temp: snap.temp } : {}),
      ...(snap.weather ? { condition: snap.weather } : {}),
      ...(snap.recordedTime ? { recordedTime: snap.recordedTime } : {}),
    };
    saveSession({ pendingRecord: next });
    return true;
  } catch (error) {
    console.warn("hydratePendingRecordFromNotion:", error);
    return false;
  }
}
