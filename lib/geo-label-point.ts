type Position = [number, number];

type GeoRing = Position[];
type GeoPolygonCoords = GeoRing[];
type GeoMultiPolygonCoords = GeoPolygonCoords[];

type GeoGeometry =
  | { type: "Polygon"; coordinates: GeoPolygonCoords }
  | { type: "MultiPolygon"; coordinates: GeoMultiPolygonCoords };

type GeoFeatureLike = { geometry: GeoGeometry };

type LngLat = { lng: number; lat: number };

/** GeoJSON 外環面積（有號，用於比較 MultiPolygon 各島） */
function ringSignedArea2(ring: GeoRing): number {
  if (ring.length < 3) return 0;
  let area2 = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j]!;
    const [x1, y1] = ring[i]!;
    area2 += x0 * y1 - x1 * y0;
  }
  return area2;
}

/** 外環面積加權質心（lng/lat） */
function ringAreaCentroid(ring: GeoRing): LngLat | null {
  const area2 = ringSignedArea2(ring);
  if (Math.abs(area2) < 1e-14) return null;

  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j]!;
    const [x1, y1] = ring[i]!;
    const cross = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  const factor = 1 / (3 * area2);
  return { lng: cx * factor, lat: cy * factor };
}

function polygonLabelPoint(coords: GeoPolygonCoords): LngLat | null {
  const outer = coords[0];
  if (!outer?.length) return null;
  return ringAreaCentroid(outer);
}

function geometryLabelPoint(geometry: GeoGeometry): LngLat | null {
  if (geometry.type === "Polygon") {
    return polygonLabelPoint(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    let best: (LngLat & { area: number }) | null = null;
    for (const poly of geometry.coordinates) {
      const outer = poly[0];
      if (!outer?.length) continue;
      const point = ringAreaCentroid(outer);
      if (!point) continue;
      const area = Math.abs(ringSignedArea2(outer));
      if (!best || area > best.area) {
        best = { ...point, area };
      }
    }
    return best ? { lng: best.lng, lat: best.lat } : null;
  }

  return null;
}

function isGeoGeometry(value: unknown): value is GeoGeometry {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: string }).type;
  return type === "Polygon" || type === "MultiPolygon";
}

/** 地圖分區標籤建議錨點（WGS84 lat/lng） */
export function featureLabelLatLng(
  feature: GeoFeatureLike
): { lat: number; lng: number } | null {
  if (!isGeoGeometry(feature.geometry)) return null;
  const point = geometryLabelPoint(feature.geometry);
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return null;
  }
  return { lat: point.lat, lng: point.lng };
}
