import L from "leaflet";
import type { Feature } from "geojson";

const PULSE_MS = 2400;
const FADE_MS = 800;
const PULSE_PANE = "colorJoinPulsePane";

function ensurePulsePane(map: L.Map): string {
  if (!map.getPane(PULSE_PANE)) {
    map.createPane(PULSE_PANE);
    const el = map.getPane(PULSE_PANE);
    if (el) {
      el.style.zIndex = "650";
      el.style.pointerEvents = "none";
    }
  }
  return PULSE_PANE;
}

/** #rrggbb → "r, g, b"（供 CSS rgba(var(--join-rgb), α)） */
export function colorHexToRgbCsv(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return "120, 113, 108";
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "120, 113, 108";
  return `${r}, ${g}, ${b}`;
}

function saturateHex(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return hex;
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return hex;
  const d = max - min;
  let s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  s = Math.min(1, s * 1.45);
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let hue = 0;
  if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue /= 6;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const to8 = (c: number) =>
    Math.round(Math.min(255, Math.max(0, c * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${to8(hue2rgb(p, q, hue + 1 / 3))}${to8(hue2rgb(p, q, hue))}${to8(hue2rgb(p, q, hue - 1 / 3))}`;
}

/** 將 layer 座標轉成 path 元素內的 clip-path 百分比中心 */
function clipOriginPercent(
  el: SVGGraphicsElement,
  originLayer: L.Point
): { x: number; y: number } {
  const bbox = el.getBBox();
  const svg = el.ownerSVGElement;
  if (!svg || bbox.width < 1 || bbox.height < 1) {
    return { x: 50, y: 50 };
  }

  const pt = svg.createSVGPoint();
  pt.x = originLayer.x;
  pt.y = originLayer.y;
  const matrix = el.getCTM();
  if (!matrix) return { x: 50, y: 50 };
  const local = pt.matrixTransform(matrix.inverse());
  return {
    x: Math.max(0, Math.min(100, ((local.x - bbox.x) / bbox.width) * 100)),
    y: Math.max(0, Math.min(100, ((local.y - bbox.y) / bbox.height) * 100)),
  };
}

function animatePathSpread(
  el: SVGGraphicsElement,
  fillHex: string,
  strokeHex: string,
  originLayer: L.Point
): Animation[] {
  const { x, y } = clipOriginPercent(el, originLayer);
  const at = `${x.toFixed(2)}% ${y.toFixed(2)}%`;

  el.setAttribute("fill", fillHex);
  el.setAttribute("fill-opacity", "0.92");
  el.setAttribute("stroke", strokeHex);
  el.setAttribute("stroke-width", "3");
  el.setAttribute("stroke-opacity", "0.95");
  el.style.pointerEvents = "none";

  const spread = el.animate(
    [
      {
        clipPath: `circle(0% at ${at})`,
        fillOpacity: 0.92,
        strokeOpacity: 0.95,
        strokeWidth: 3,
      },
      {
        clipPath: `circle(158% at ${at})`,
        fillOpacity: 0.88,
        strokeOpacity: 0.55,
        strokeWidth: 2,
      },
    ],
    {
      duration: PULSE_MS,
      easing: "cubic-bezier(0.12, 0.88, 0.18, 1)",
      fill: "forwards",
    }
  );

  const fade = el.animate(
    [
      { fillOpacity: 0.88, strokeOpacity: 0.45, strokeWidth: 2 },
      { fillOpacity: 0, strokeOpacity: 0, strokeWidth: 0 },
    ],
    {
      duration: FADE_MS,
      delay: PULSE_MS,
      easing: "ease-out",
      fill: "forwards",
    }
  );

  return [spread, fade];
}

/**
 * 以主色從 origin 做 clip-path 放射擴散，沿行政區形狀由內向外鋪開。
 */
export function playRegionShapeColorPulse(
  map: L.Map,
  feature: Feature,
  colorHex: string,
  origin: L.LatLng
): () => void {
  const fillHex = saturateHex(colorHex);
  const strokeHex = saturateHex(fillHex);

  const pulseLayer = L.geoJSON(feature, {
    interactive: false,
    pane: ensurePulsePane(map),
    style: {
      fillColor: fillHex,
      fillOpacity: 0,
      weight: 3,
      opacity: 1,
      color: strokeHex,
      className: "map-region-color-join-pulse",
    },
  });

  pulseLayer.addTo(map);
  pulseLayer.bringToFront();

  let cleaned = false;
  let pulseLayerRef: L.GeoJSON | null = pulseLayer;
  const animations: Animation[] = [];
  let endTimer: number | undefined;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (endTimer != null) window.clearTimeout(endTimer);
    for (const a of animations) {
      try {
        a.cancel();
      } catch {
        /* ignore */
      }
    }
    animations.length = 0;
    pulseLayerRef?.remove();
    pulseLayerRef = null;
  };

  let spreadAttempts = 0;

  const runSpread = () => {
    const originLayer = map.latLngToLayerPoint(origin);
    const paths: SVGGraphicsElement[] = [];

    pulseLayer.eachLayer((layer) => {
      if (!("getElement" in layer)) return;
      const el = (layer as L.Path).getElement?.();
      if (el instanceof SVGGraphicsElement) paths.push(el);
    });

    if (paths.length === 0) {
      if (spreadAttempts < 4) {
        spreadAttempts += 1;
        endTimer = window.setTimeout(runSpread, 80);
        return;
      }
      endTimer = window.setTimeout(cleanup, PULSE_MS + FADE_MS);
      return;
    }

    for (const el of paths) {
      animations.push(...animatePathSpread(el, fillHex, strokeHex, originLayer));
    }

    endTimer = window.setTimeout(cleanup, PULSE_MS + FADE_MS + 120);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      runSpread();
    });
  });

  return cleanup;
}
