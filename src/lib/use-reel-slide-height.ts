import { useEffect, useRef } from "react";

/** iOS Safari：量測 Reels 捲動區高度，讓每張 slide 以 px 填滿可視區 */
export function useReelSlideHeight<T extends HTMLElement>(deps: unknown[] = []) {
  const scrollRef = useRef<T>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const sync = () => {
      const height = el.clientHeight;
      if (height > 0) {
        el.style.setProperty("--reel-slide-height", `${height}px`);
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);

    window.visualViewport?.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const t = window.setTimeout(sync, 80);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      window.visualViewport?.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, deps);

  return scrollRef;
}
