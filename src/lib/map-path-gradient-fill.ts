import type L from "leaflet";

export type MapPathFill = {
  hex: string;
  hex2?: string;
  hex3?: string;
};

function gradientIdForHexes(hexes: string[]): string {
  return `ow-map-grad-${hexes.map((h) => h.replace("#", "").toLowerCase()).join("-")}`;
}

function ensureSvgLinearGradient(
  svg: SVGSVGElement,
  id: string,
  stops: Array<{ offset: string; color: string }>
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

  for (const { offset, color } of stops) {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    lg.appendChild(stop);
  }
  defs.appendChild(lg);
}

/** 將填色套到 Leaflet path（並列時為兩色或三色對角漸層） */
export function applyMapPathGradientFill(
  path: L.Path,
  fill: MapPathFill,
  fillOpacity: number
): void {
  const el = path.getElement?.();
  if (!el || !(el instanceof SVGGraphicsElement)) return;
  const svg = el.ownerSVGElement;
  if (!svg) return;

  if (fill.hex3 && fill.hex2) {
    const hexes = [fill.hex, fill.hex2, fill.hex3];
    const id = gradientIdForHexes(hexes);
    ensureSvgLinearGradient(svg, id, [
      { offset: "0%", color: fill.hex },
      { offset: "50%", color: fill.hex2 },
      { offset: "100%", color: fill.hex3 },
    ]);
    el.setAttribute("fill", `url(#${id})`);
  } else if (fill.hex2) {
    const id = gradientIdForHexes([fill.hex, fill.hex2]);
    ensureSvgLinearGradient(svg, id, [
      { offset: "0%", color: fill.hex },
      { offset: "100%", color: fill.hex2 },
    ]);
    el.setAttribute("fill", `url(#${id})`);
  } else {
    el.setAttribute("fill", fill.hex);
  }
  el.setAttribute("fill-opacity", String(fillOpacity));
}
