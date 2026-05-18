import { useEffect, useRef } from "react";
import { FEEL_TRACK_EMPTY } from "../lib/feel-metrics";

type FeelRangeSliderProps = {
  value: number;
  min?: number;
  max?: number;
  color: string;
  onChange: (value: number) => void;
  "aria-label": string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function FeelRangeSlider({
  value,
  min = 0,
  max = 100,
  color,
  onChange,
  "aria-label": ariaLabel,
}: FeelRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const draggingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  onChangeRef.current = onChange;

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      draggingRef.current = false;
    },
    []
  );

  const valueFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const { left, width } = track.getBoundingClientRect();
    if (width <= 0) return value;
    const ratio = clamp((clientX - left) / width, 0, 1);
    return Math.round(min + ratio * (max - min));
  };

  const applyClientX = (clientX: number) => {
    onChangeRef.current(valueFromClientX(clientX));
  };

  const endDrag = () => {
    draggingRef.current = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
  };

  const startDrag = (clientX: number) => {
    endDrag();
    draggingRef.current = true;
    applyClientX(clientX);

    const onMove = (ev: PointerEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      if ("touches" in ev) ev.preventDefault();
      const x = "touches" in ev ? ev.touches[0]?.clientX : ev.clientX;
      if (x != null) applyClientX(x);
    };

    const onEnd = () => endDrag();

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);

    cleanupRef.current = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientX);
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && "PointerEvent" in window) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;
    startDrag(touch.clientX);
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      className="feel-range relative flex h-11 w-full cursor-grab touch-none select-none items-center active:cursor-grabbing"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(clamp(value + 1, min, max));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(clamp(value - 1, min, max));
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-lg"
        style={{ backgroundColor: FEEL_TRACK_EMPTY }}
      />
      <div
        className="pointer-events-none absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-lg"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
      <div
        className="pointer-events-none absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-[0_4px_10px_rgba(0,0,0,0.12)]"
        style={{ left: `${percent}%`, borderColor: color }}
      />
    </div>
  );
}
