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
  compact = false,
}: {
  reminder: ReminderConfig;
  onChange: (next: ReminderConfig) => void;
  showToast: (msg: string) => void;
  className?: string;
  compact?: boolean;
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
    <div
      className={`record-panel glass-card-strong box-border ${
        compact ? "p-3.5" : "p-4"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`font-semibold text-stone-500 ${
              compact ? "text-xs" : "text-[10px] uppercase tracking-wider text-slate-400"
            }`}
          >
            晚間提醒
          </p>
          <p
            className={`mt-1 leading-snug text-stone-600 ${
              compact ? "text-[13px]" : "text-sm"
            }`}
          >
            記錄完成後，於設定時間提醒你填寫體感
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={!supported}
          className={`shrink-0 flex items-center justify-center transition-colors ${
            compact ? "h-9 w-9" : "h-10 w-10"
          } ${
            reminder.enabled
              ? "bg-[#378ADD] text-white"
              : "bg-stone-100 text-stone-400"
          } disabled:opacity-50`}
          aria-label={reminder.enabled ? "關閉晚間提醒" : "開啟晚間提醒"}
        >
          {reminder.enabled ? <Bell size={compact ? 16 : 18} /> : <BellOff size={compact ? 16 : 18} />}
        </button>
      </div>

      {reminder.enabled && (
        <label className="mt-2.5 flex items-center justify-between gap-3 border-t border-stone-100 pt-2.5">
          <span className="text-xs font-medium text-stone-500">提醒時間</span>
          <input
            type="time"
            value={formatTime(reminder.hour, reminder.minute)}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
          />
        </label>
      )}

      {!supported && (
        <p className="record-panel__note mt-2 text-xs leading-relaxed text-amber-800/90">
          此環境不支援推播，仍可用晚間連結開啟填寫。
        </p>
      )}
      {supported && permission === "denied" && (
        <p className="record-panel__note mt-2 text-xs leading-relaxed text-amber-800/90">
          通知權限已拒絕，請至瀏覽器設定開啟。
        </p>
      )}
    </div>
  );
}
