import type L from "leaflet";

export type MapPathFill = {
  hex: string;
  hex2?: string;
};

function gradientIdForPair(hex1: string, hex2: string): string {
  const a = hex1.replace("#", "").toLowerCase();
  const b = hex2.replace("#", "").toLowerCase();
  return `ow-map-grad-${a}-${b}`;
}

function ensureSvgGradient(
  svg: SVGSVGElement,
  id: string,
  hex1: string,
  hex2: string
): void {
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  if (defs.querySelector(`#${id}`)) return;

  const lg = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  lg.setAttribute("id", id);
  lg.setAttribute("x1", "0%");
  lg.setAttribute("y1", "0%");
  lg.setAttribute("x2", "100%");
  lg.setAttribute("y2", "100%");
  lg.setAttribute("gradientUnits", "objectBoundingBox");

  for (const [offset, color] of [
    ["0%", hex1],
    ["100%", hex2],
  ] as const) {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    lg.appendChild(stop);
  }
  defs.appendChild(lg);
}

/** 將填色套到 Leaflet path（並列第一時為兩色對角漸層） */
export function applyMapPathGradientFill(
  path: L.Path,
  fill: MapPathFill,
  fillOpacity: number
): void {
  const el = path.getElement?.();
  if (!el || !(el instanceof SVGGraphicsElement)) return;
  const svg = el.ownerSVGElement;
  if (!svg) return;

  if (fill.hex2) {
    const id = gradientIdForPair(fill.hex, fill.hex2);
    ensureSvgGradient(svg, id, fill.hex, fill.hex2);
    el.setAttribute("fill", `url(#${id})`);
  } else {
    el.setAttribute("fill", fill.hex);
  }
  el.setAttribute("fill-opacity", String(fillOpacity));
}
