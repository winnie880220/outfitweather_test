/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, type PrecacheEntry } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

type ScheduleMessage = {
  type: "SCHEDULE_REMINDER";
  at: number;
  pageId: string;
  url: string;
};

type CancelMessage = { type: "CANCEL_REMINDER" };

let reminderTimer: ReturnType<typeof setTimeout> | null = null;

function clearReminderTimer() {
  if (reminderTimer !== null) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
}

self.addEventListener("message", (event) => {
  const data = event.data as ScheduleMessage | CancelMessage | undefined;
  if (!data?.type) return;

  if (data.type === "CANCEL_REMINDER") {
    clearReminderTimer();
    return;
  }

  if (data.type === "SCHEDULE_REMINDER") {
    clearReminderTimer();
    const delay = Math.max(0, data.at - Date.now());
    reminderTimer = setTimeout(() => {
      void self.registration.showNotification("該回報今日穿搭體感了", {
        body: "點一下繼續填寫悶熱度、透氣度…",
        icon: "/icons/icon.svg",
        tag: `evening-feedback-${data.pageId}`,
        data: { url: data.url },
      });
    }, delay);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            await client.navigate(url);
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
