import { Bell, BellOff } from "lucide-react";
import type { ReminderSettings as ReminderConfig } from "../lib/session-storage";
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from "../lib/reminder";

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return { hour: h, minute: m };
}

export function ReminderSettingsPanel({
  reminder,
  onChange,
  showToast,
  className = "mt-4",
}: {
  reminder: ReminderConfig;
  onChange: (next: ReminderConfig) => void;
  showToast: (msg: string) => void;
  className?: string;
}) {
  const supported = isNotificationSupported();
  const permission = getNotificationPermission();

  const handleToggle = async () => {
    if (!supported) {
      showToast("此瀏覽器不支援通知");
      return;
    }

    if (!reminder.enabled) {
      const result = await requestNotificationPermission();
      if (result !== "granted") {
        showToast(
          result === "denied"
            ? "通知已關閉，請到瀏覽器設定中開啟"
            : "需要通知權限才能開啟晚間提醒"
        );
        return;
      }
      onChange({ ...reminder, enabled: true });
      showToast(`已開啟晚間提醒（${formatTime(reminder.hour, reminder.minute)}）`);
      return;
    }

    onChange({ ...reminder, enabled: false });
    showToast("已關閉晚間提醒");
  };

  const handleTimeChange = (value: string) => {
    const parsed = parseTime(value);
    if (!parsed) return;
    onChange({ ...reminder, hour: parsed.hour, minute: parsed.minute });
  };

  return (
    <div className={`glass-card-strong box-border rounded-2xl p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            晚間提醒
          </p>
          <p className="mt-1 text-sm text-stone-600 leading-snug">
            拍照記錄後，在設定時間提醒你回來填寫體感
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={!supported}
          className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
            reminder.enabled
              ? "bg-[#378ADD] text-white"
              : "bg-stone-100 text-stone-400"
          } disabled:opacity-50`}
          aria-label={reminder.enabled ? "關閉晚間提醒" : "開啟晚間提醒"}
        >
          {reminder.enabled ? <Bell size={18} /> : <BellOff size={18} />}
        </button>
      </div>

      {reminder.enabled && (
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-stone-500">提醒時間</span>
          <input
            type="time"
            value={formatTime(reminder.hour, reminder.minute)}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-800"
          />
        </label>
      )}

      {!supported && (
        <p className="mt-2 text-xs text-amber-700">此環境不支援推播，仍可用晚間連結開啟填寫。</p>
      )}
      {supported && permission === "denied" && (
        <p className="mt-2 text-xs text-amber-700">
          通知權限已拒絕，請至瀏覽器網站設定開啟；或安裝到主畫面後再試（iOS 支援有限）。
        </p>
      )}
    </div>
  );
}
