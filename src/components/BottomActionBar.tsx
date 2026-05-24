import type { ReactNode } from "react";

export type BottomActionSide = {
  icon: ReactNode;
  onClick: () => void;
  className?: string;
  ariaLabel: string;
};

export function BottomActionBar({
  primaryLabel,
  onPrimary,
  left,
  right,
  solo = false,
  disabled = false,
  loading = false,
  className = "",
  buttonRadius = "pill",
}: {
  primaryLabel: string;
  onPrimary: () => void;
  left?: BottomActionSide;
  right?: BottomActionSide;
  solo?: boolean;
  /** 無法操作（例如尚未上傳照片） */
  disabled?: boolean;
  /** 處理中：維持主按鈕樣式，僅防止重複點擊 */
  loading?: boolean;
  className?: string;
  /** pill = 全圓角按鈕；card = 與記錄頁卡片一致的 1rem 圓角 */
  buttonRadius?: "pill" | "card";
}) {
  const btnRound = buttonRadius === "card" ? "rounded-2xl" : "rounded-full";
  const primaryBtnClass = disabled
    ? `h-11 w-full cursor-not-allowed ${btnRound} bg-white/50 text-sm font-semibold text-slate-400 opacity-50`
    : loading
      ? `btn-gradient-primary h-11 w-full cursor-wait ${btnRound} text-sm font-semibold text-white opacity-90`
      : `btn-gradient-primary h-11 w-full ${btnRound} text-sm font-semibold text-white transition-all active:scale-95`;
  const primaryDisabled = disabled || loading;
  const sideBtnBase =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all hover:bg-stone-50 active:scale-95";

  if (solo) {
    return (
      <div
        className={`glass-card-strong w-full shrink-0 rounded-2xl border-0 px-4 py-3 ${className}`}
      >
        <button
          type="button"
          disabled={primaryDisabled}
          aria-busy={loading}
          onClick={onPrimary}
          className={primaryBtnClass}
        >
          {primaryLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`glass-card-strong flex w-full shrink-0 items-center justify-between gap-3 rounded-2xl border-0 px-4 py-3 ${className}`}
    >
      {left ? (
        <button
          type="button"
          onClick={left.onClick}
          aria-label={left.ariaLabel}
          className={`${sideBtnBase} ${left.className ?? "border-stone-200 text-stone-400"}`}
        >
          {left.icon}
        </button>
      ) : (
        <div className="h-12 w-12 shrink-0" aria-hidden />
      )}

      <button
        type="button"
        disabled={primaryDisabled}
        aria-busy={loading}
        onClick={onPrimary}
        className={
          disabled
            ? "h-11 min-w-0 flex-1 cursor-not-allowed rounded-full bg-white/50 text-sm font-semibold text-slate-400 opacity-50"
            : loading
              ? "btn-gradient-primary h-11 min-w-0 flex-1 cursor-wait rounded-full text-sm font-semibold text-white opacity-90"
              : "btn-gradient-primary h-11 min-w-0 flex-1 rounded-full text-sm font-semibold text-white transition-all active:scale-95"
        }
      >
        {primaryLabel}
      </button>

      {right ? (
        <button
          type="button"
          onClick={right.onClick}
          aria-label={right.ariaLabel}
          className={`${sideBtnBase} ${right.className ?? "border-stone-200 text-stone-400"}`}
        >
          {right.icon}
        </button>
      ) : (
        <div className="h-12 w-12 shrink-0" aria-hidden />
      )}
    </div>
  );
}
