import type { ReminderSettings } from "./session-storage";
import { buildRecordUrl } from "./record-url";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/** 今日 reminder 時刻的 timestamp；若已過則改為 2 分鐘後（方便晚間補存檔仍會提醒） */
export function getReminderTimestamp(reminder: ReminderSettings): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(reminder.hour, reminder.minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setTime(now.getTime() + 2 * 60 * 1000);
  }
  return target.getTime();
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function scheduleEveningReminder(
  pageId: string,
  reminder: ReminderSettings
): Promise<boolean> {
  if (!reminder.enabled) return false;
  if (getNotificationPermission() !== "granted") return false;

  const reg = await getServiceWorkerRegistration();
  const sw = reg?.active ?? reg?.waiting ?? reg?.installing;
  if (!sw) return false;

  const at = getReminderTimestamp(reminder);
  const url = buildRecordUrl(pageId);

  sw.postMessage({
    type: "SCHEDULE_REMINDER",
    at,
    pageId,
    url,
  });
  return true;
}

export async function cancelEveningReminder(): Promise<void> {
  const reg = await getServiceWorkerRegistration();
  const sw = reg?.active;
  sw?.postMessage({ type: "CANCEL_REMINDER" });
}

/** App 回到前景時：若已過提醒時間且仍有 pending，補發一次（SW 可能被系統回收） */
export async function maybeShowPendingReminderNotification(
  pageId: string,
  reminder: ReminderSettings
): Promise<void> {
  if (!reminder.enabled || getNotificationPermission() !== "granted") return;

  const now = Date.now();
  const todayAt = new Date();
  todayAt.setHours(reminder.hour, reminder.minute, 0, 0);
  if (now < todayAt.getTime()) return;

  const reg = await getServiceWorkerRegistration();
  if (!reg) return;

  const tag = `evening-feedback-${pageId}`;
  const existing = await reg.getNotifications({ tag });
  if (existing.length > 0) return;

  const url = buildRecordUrl(pageId);
  await reg.showNotification("該回報今日穿搭體感了", {
    body: "點一下繼續填寫悶熱度、透氣度…",
    icon: "/icons/icon.svg",
    tag,
    data: { url },
  });
}
