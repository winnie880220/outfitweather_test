import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import { Cloud, Droplets, MapPin, Sun, Thermometer } from "lucide-react";
import {
  formatTodayTempRange,
  hasDailyTempRange,
} from "../../lib/weather-display";
import { regionKey, regionLabel, type MapRegion } from "../../lib/map-region";
import {
  isTaipeiDistrict,
  TAIPEI_COUNTY,
  TAIPEI_DISTRICT_CENTROIDS,
  TAIPEI_DISTRICTS,
  type TaipeiDistrict,
} from "../../lib/taipei-district";
import {
  COUNTY_CENTROIDS,
  isTaiwanCounty,
  type TaiwanCounty,
} from "../../lib/taiwan-county";
import type { RegionColorFill } from "../lib/api/region-color-fills";
import type { WeatherData } from "../types/api";
import "leaflet/dist/leaflet.css";

const COUNTIES_TOPO_URL = "/geo/tw-counties-10t.json";
const TOWNS_TOPO_URL = "/geo/tw-towns-10t.json";

const TAIWAN_MAP_BOUNDS: L.LatLngBoundsExpression = [
  [21.7, 118.2],
  [26.4, 122.3],
];

/** 放大至此層級且視野涵蓋台北市時，自動顯示行政區分區 */
const TAIPEI_DISTRICTS_MIN_ZOOM = 12;

export type MapViewMode = "counties" | "taipei-districts";

function countyStyle(
  selected: boolean,
  dimmed = false,
  userLocated = false
): L.PathOptions {
  if (selected) {
    return {
      fillColor: "#e8dfd0",
      fillOpacity: dimmed ? 0.55 : 0.95,
      color: "#8b7355",
      weight: 2,
      opacity: dimmed ? 0.65 : 0.95,
    };
  }
  if (userLocated) {
    return {
      fillColor: "#e4eef5",
      fillOpacity: dimmed ? 0.45 : 0.9,
      color: "#5b8fd4",
      weight: 2.5,
      opacity: dimmed ? 0.6 : 0.95,
    };
  }
  return {
    fillColor: "#faf7f2",
    fillOpacity: dimmed ? 0.35 : 0.82,
    color: "#d6d3d1",
    weight: 1,
    opacity: dimmed ? 0.5 : 0.95,
  };
}

function districtStyle(selected: boolean, userLocated = false): L.PathOptions {
  if (selected) {
    return {
      fillColor: "#e0d4c4",
      fillOpacity: 0.92,
      color: "#8b7355",
      weight: 2.5,
      opacity: 0.95,
    };
  }
  if (userLocated) {
    return {
      fillColor: "#dce8f4",
      fillOpacity: 0.9,
      color: "#4a7ab8",
      weight: 2.5,
      opacity: 0.95,
    };
  }
  return {
    fillColor: "#f5f0e8",
    fillOpacity: 0.78,
    color: "#a8a29e",
    weight: 1.25,
    opacity: 0.95,
  };
}

function pathStyleWithTopColor(
  hex: string | undefined,
  selected: boolean,
  dimmed: boolean,
  userLocated: boolean,
  fallback: () => L.PathOptions
): L.PathOptions {
  if (!hex) return fallback();

  const border = selected
    ? "#57534e"
    : userLocated
      ? "#4a7ab8"
      : "rgba(68, 64, 60, 0.42)";

  return {
    fillColor: hex,
    fillOpacity: selected ? 0.92 : dimmed ? 0.48 : userLocated ? 0.88 : 0.8,
    color: border,
    weight: selected || userLocated ? 2.5 : 1.5,
    opacity: dimmed ? 0.72 : 0.95,
  };
}

function userDistrictLabelIcon(district: TaipeiDistrict): L.DivIcon {
  const safe = district.replace(/"/g, "");
  return L.divIcon({
    className: "map-user-district-label-icon",
    html: `<span class="map-user-district-label" title="目前位置：${safe}"><span class="map-user-district-label__name">${safe}</span><span class="map-user-district-label__sep" aria-hidden="true">·</span><span class="map-user-district-label__hint">目前位置</span></span>`,
    iconSize: [96, 22],
    iconAnchor: [48, 11],
  });
}

/** 行政區名稱（去掉「區」字以節省空間） */
function districtNameLabelIcon(district: TaipeiDistrict): L.DivIcon {
  const safe = district.replace(/"/g, "");
  const short = district.replace(/區$/, "");
  return L.divIcon({
    className: "map-district-name-label-icon",
    html: `<span class="map-district-name-label" title="${safe}">${short}</span>`,
    iconSize: [36, 14],
    iconAnchor: [18, 7],
  });
}

function MapWeatherOverlay({
  weather,
  loading,
  regionName,
}: {
  weather: WeatherData | null;
  loading: boolean;
  regionName?: string | null;
}) {
  if (loading) {
    return (
      <div className="map-weather-overlay glass-card-strong map-weather-overlay--loading animate-pulse">
        <div className="h-3 w-20 rounded bg-stone-200/80" />
        <div className="mt-1 h-4 w-14 rounded bg-stone-200/80" />
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="map-weather-overlay glass-card-strong">
        <p className="text-[10px] text-stone-500">天氣載入失敗</p>
      </div>
    );
  }

  return (
    <div className="map-weather-overlay glass-card-strong">
      <div className="map-weather-overlay__head">
        <p className="map-weather-overlay__loc">
          <MapPin size={11} className="shrink-0" aria-hidden />
          <span className="truncate">{regionName ?? weather.locationName}</span>
        </p>
        <Sun size={18} className="map-weather-overlay__icon shrink-0" strokeWidth={1.75} />
      </div>
      <div className="map-weather-overlay__temp-row">
        <span className="map-weather-overlay__temp tabular-nums">
          {Math.round(weather.temp)}°
        </span>
        <span className="map-weather-overlay__cond">{weather.condition}</span>
      </div>
      {hasDailyTempRange(weather) ? (
        <p className="map-weather-overlay__daily-range tabular-nums">
          {formatTodayTempRange(weather)}
        </p>
      ) : null}
      <div className="map-weather-overlay__metrics">
        <span className="map-weather-overlay__metric">
          <Droplets size={11} aria-hidden />
          {Math.round(weather.humidity)}%
        </span>
        <span className="map-weather-overlay__metric">
          <Cloud size={11} aria-hidden />
          雨 {weather.rainProb}%
        </span>
        <span className="map-weather-overlay__metric">
          <Thermometer size={11} aria-hidden />
          體感 {Math.round(weather.apparentTemp)}°
        </span>
        <span className="map-weather-overlay__metric">
          <Sun size={11} aria-hidden />
          UV {Math.round(weather.uvIndex)}
        </span>
      </div>
    </div>
  );
}

export function TaiwanOutfitMap({
  regionColorFills,
  weather,
  weatherLoading,
  userCounty,
  userDistrict,
  mapView,
  onMapViewChange,
  selectedRegion,
  onSelectRegion,
}: {
  /** 各區顏色排行第一，填滿行政區／縣市形狀 */
  regionColorFills: RegionColorFill[];
  weather: WeatherData | null;
  weatherLoading: boolean;
  userCounty: TaiwanCounty | null;
  userDistrict: TaipeiDistrict | null;
  mapView: MapViewMode;
  onMapViewChange: (view: MapViewMode) => void;
  selectedRegion: MapRegion | null;
  onSelectRegion: (region: MapRegion | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countyLayerRef = useRef<L.GeoJSON | null>(null);
  const districtLayerRef = useRef<L.GeoJSON | null>(null);
  const countyBoundsRef = useRef<Map<string, L.LatLngBounds>>(new Map());
  const districtBoundsRef = useRef<Map<string, L.LatLngBounds>>(new Map());
  const taipeiBoundsRef = useRef<L.LatLngBounds | null>(null);
  const userDistrictMarkerRef = useRef<L.Marker | null>(null);
  const districtLabelsLayerRef = useRef<L.LayerGroup | null>(null);
  const initialFocusDone = useRef(false);
  const lastFocusedRegionKeyRef = useRef<string | null>(null);
  const mapInteractionRef = useRef({
    mapView,
    districtsVisibleByZoom: false,
    onMapViewChange,
    onSelectRegion,
  });
  const [mapReady, setMapReady] = useState(false);
  const [districtsReady, setDistrictsReady] = useState(false);
  const [districtsVisibleByZoom, setDistrictsVisibleByZoom] = useState(false);

  mapInteractionRef.current = {
    mapView,
    districtsVisibleByZoom,
    onMapViewChange,
    onSelectRegion,
  };

  const showDistrictLayers =
    mapView === "taipei-districts" && districtsVisibleByZoom;

  const countyFillByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const fill of regionColorFills) {
      if (!fill.district) map.set(fill.county, fill.hex);
    }
    return map;
  }, [regionColorFills]);

  const districtFillByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const fill of regionColorFills) {
      if (fill.district) map.set(fill.district, fill.hex);
    }
    return map;
  }, [regionColorFills]);

  const focusBounds = useCallback(
    (bounds: L.LatLngBounds, maxZoom = 11, minZoom?: number) => {
      const map = mapRef.current;
      if (!map || !bounds.isValid()) return;
      map.fitBounds(bounds, { padding: [40, 40], maxZoom, animate: true });
      if (minZoom == null) return;
      const ensureMinZoom = () => {
        if (map.getZoom() < minZoom) {
          map.setZoom(minZoom, { animate: true });
        }
      };
      map.once("zoomend", ensureMinZoom);
      window.setTimeout(ensureMinZoom, 320);
    },
    []
  );

  const getTaipeiBounds = useCallback((): L.LatLngBounds | null => {
    const bounds =
      taipeiBoundsRef.current ?? countyBoundsRef.current.get(TAIPEI_COUNTY) ?? null;
    return bounds?.isValid() ? bounds : null;
  }, []);

  const mapViewportCoversTaipei = useCallback(
    (map: L.Map) => {
      const taipei = getTaipeiBounds();
      if (!taipei) return false;
      return map.getBounds().intersects(taipei);
    },
    [getTaipeiBounds]
  );

  const focusDistrict = useCallback(
    (district: TaipeiDistrict) => {
      const map = mapRef.current;
      const bounds = districtBoundsRef.current.get(district);
      if (!map || !bounds?.isValid()) return;

      const fitZoom = map.getBoundsZoom(bounds, false, [36, 36]);
      const zoom = Math.max(
        TAIPEI_DISTRICTS_MIN_ZOOM,
        Math.min(13, Number.isFinite(fitZoom) ? fitZoom : TAIPEI_DISTRICTS_MIN_ZOOM)
      );
      map.setView(bounds.getCenter(), zoom, { animate: true });
    },
    []
  );

  const applyCountyStyles = useCallback(() => {
    const dimmed = showDistrictLayers;
    countyLayerRef.current?.eachLayer((layer) => {
      const feat = (layer as L.Layer & { feature?: Feature }).feature;
      const name = feat?.properties?.COUNTYNAME as string | undefined;
      const selected =
        selectedRegion?.level === "county" && selectedRegion.county === name;
      const userLocated =
        (mapView === "counties" || !showDistrictLayers) &&
        !!userCounty &&
        userCounty === name &&
        !selected;
      const topHex = name ? countyFillByName.get(name) : undefined;
      if ("setStyle" in layer) {
        const path = layer as L.Path;
        /** 顯示行政區時，台北市縣市層不填色，避免蓋住分區邊界 */
        if (name === TAIPEI_COUNTY && showDistrictLayers) {
          path.setStyle({
            fillColor: "transparent",
            fillOpacity: 0,
            color: "transparent",
            weight: 0,
            opacity: 0,
          });
          path.options.interactive = false;
          return;
        }
        path.setStyle(
          pathStyleWithTopColor(topHex, !!selected, dimmed, userLocated, () =>
            countyStyle(!!selected, dimmed, userLocated)
          )
        );
        path.options.interactive = !(name === TAIPEI_COUNTY && dimmed);
      }
    });
  }, [mapView, showDistrictLayers, selectedRegion, userCounty, countyFillByName]);

  const syncDistrictNameLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const hide = !showDistrictLayers || !districtsReady;

    if (hide) {
      districtLabelsLayerRef.current?.clearLayers();
      if (
        districtLabelsLayerRef.current &&
        map.hasLayer(districtLabelsLayerRef.current)
      ) {
        map.removeLayer(districtLabelsLayerRef.current);
      }
      districtLabelsLayerRef.current = null;
      return;
    }

    if (!districtLabelsLayerRef.current) {
      districtLabelsLayerRef.current = L.layerGroup().addTo(map);
    }

    const group = districtLabelsLayerRef.current;
    group.clearLayers();

    for (const district of TAIPEI_DISTRICTS) {
      if (userDistrict && district === userDistrict) continue;

      const bounds = districtBoundsRef.current.get(district);
      const latLng: L.LatLngExpression = bounds?.isValid()
        ? bounds.getCenter()
        : TAIPEI_DISTRICT_CENTROIDS[district];

      L.marker(latLng, {
        icon: districtNameLabelIcon(district),
        interactive: false,
        zIndexOffset: 250,
      }).addTo(group);
    }
  }, [showDistrictLayers, districtsReady, userDistrict]);

  const applyDistrictStyles = useCallback(() => {
    districtLayerRef.current?.eachLayer((layer) => {
      const feat = (layer as L.Layer & { feature?: Feature }).feature;
      const name = feat?.properties?.TOWNNAME as string | undefined;
      const selected =
        selectedRegion?.level === "district" && selectedRegion.district === name;
      const userLocated =
        showDistrictLayers &&
        !!userDistrict &&
        userDistrict === name &&
        !selected;
      const topHex = name ? districtFillByName.get(name) : undefined;
      if ("setStyle" in layer) {
        const path = layer as L.Path;
        const style = pathStyleWithTopColor(topHex, !!selected, false, userLocated, () =>
          districtStyle(!!selected, userLocated)
        );
        path.setStyle({ ...style, stroke: true });
        path.options.interactive = true;
      }
    });
  }, [showDistrictLayers, selectedRegion, userDistrict, districtFillByName]);

  const syncDistrictLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    const districtLayer = districtLayerRef.current;
    if (!map || !districtLayer || !districtsReady) return;

    if (!map.hasLayer(districtLayer)) districtLayer.addTo(map);

    districtLayer.eachLayer((layer) => {
      const path = layer as L.Path;
      if (!("setStyle" in path)) return;
      if (!showDistrictLayers) {
        path.setStyle({
          fillOpacity: 0,
          opacity: 0,
          weight: 0,
          color: "transparent",
        });
        path.options.interactive = false;
      }
    });

    if (showDistrictLayers) {
      districtLayer.bringToFront();
      applyDistrictStyles();
    } else {
      countyLayerRef.current?.bringToFront();
    }
  }, [showDistrictLayers, districtsReady, applyDistrictStyles]);

  const loadDistrictLayer = useCallback(
    async (map: L.Map) => {
      if (districtLayerRef.current) return;

      const res = await fetch(TOWNS_TOPO_URL);
      if (!res.ok) throw new Error("towns topo load failed");
      const topology = (await res.json()) as Topology;
      const obj = topology.objects.towns;
      if (!obj) return;

      const allTowns = feature(topology, obj) as FeatureCollection<Geometry> | null;
      if (!allTowns) return;

      const taipeiFeatures = allTowns.features.filter(
        (f) => f.properties?.COUNTYNAME === TAIPEI_COUNTY
      );

      const taipeiCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: taipeiFeatures,
      };

      districtBoundsRef.current.clear();
      const boundsList: L.LatLngBounds[] = [];

      districtLayerRef.current = L.geoJSON(taipeiCollection, {
        style: () => districtStyle(false),
        onEachFeature: (feat, layer) => {
          const name = feat.properties?.TOWNNAME as string | undefined;
          if (!name || !isTaipeiDistrict(name)) return;

          const b = (layer as L.Polygon).getBounds?.();
          if (b?.isValid()) {
            districtBoundsRef.current.set(name, b);
            boundsList.push(b);
          }

          layer.on({
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              onSelectRegion({
                level: "district",
                county: TAIPEI_COUNTY,
                district: name,
              });
              const mapInstance = mapRef.current;
              const bounds = districtBoundsRef.current.get(name);
              if (mapInstance && bounds?.isValid()) {
                const fitZoom = mapInstance.getBoundsZoom(bounds, false, [36, 36]);
                const zoom = Math.max(
                  TAIPEI_DISTRICTS_MIN_ZOOM,
                  Math.min(
                    13,
                    Number.isFinite(fitZoom) ? fitZoom : TAIPEI_DISTRICTS_MIN_ZOOM
                  )
                );
                mapInstance.setView(bounds.getCenter(), zoom, { animate: true });
              }
            },
          });
        },
      });

      if (boundsList.length > 0) {
        taipeiBoundsRef.current = boundsList.reduce((acc, b) => acc.extend(b));
      }

      districtLayerRef.current.addTo(map);
      setDistrictsReady(true);
    },
    [onSelectRegion]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: COUNTY_CENTROIDS[TAIPEI_COUNTY],
      zoom: 8,
      minZoom: 6,
      maxZoom: 13,
      maxBounds: TAIWAN_MAP_BOUNDS,
      maxBoundsViscosity: 1,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      dragging: true,
    });

    L.control.zoom({ position: "topleft" }).addTo(map);
    mapRef.current = map;

    let cancelled = false;

    void fetch(COUNTIES_TOPO_URL)
      .then((res) => {
        if (!res.ok) throw new Error("counties topo load failed");
        return res.json() as Promise<Topology>;
      })
      .then((topology) => {
        if (cancelled || !mapRef.current) return;
        const obj = topology.objects.counties;
        if (!obj) return;
        const counties = feature(topology, obj) as FeatureCollection<Geometry> | null;
        if (!counties) return;

        countyBoundsRef.current.clear();

        countyLayerRef.current = L.geoJSON(counties, {
          style: () => countyStyle(false),
          onEachFeature: (feat, layer) => {
            const name = feat.properties?.COUNTYNAME as string | undefined;
            if (!name || !isTaiwanCounty(name)) return;

            const bounds = (layer as L.Polygon).getBounds?.();
            if (bounds?.isValid()) countyBoundsRef.current.set(name, bounds);

            layer.on({
              click: () => {
                const {
                  mapView: view,
                  districtsVisibleByZoom: districtsVisible,
                  onMapViewChange: setView,
                  onSelectRegion: selectRegion,
                } = mapInteractionRef.current;

                if (name === TAIPEI_COUNTY) {
                  if (view === "taipei-districts" && !districtsVisible) {
                    selectRegion({ level: "county", county: TAIPEI_COUNTY });
                    return;
                  }
                  setView("taipei-districts");
                  selectRegion(null);
                  const mapInstance = mapRef.current;
                  const bounds =
                    taipeiBoundsRef.current ??
                    countyBoundsRef.current.get(TAIPEI_COUNTY);
                  if (mapInstance && bounds?.isValid()) {
                    mapInstance.fitBounds(bounds, {
                      padding: [40, 40],
                      maxZoom: 12,
                      animate: true,
                    });
                  }
                  return;
                }

                setView("counties");
                selectRegion({ level: "county", county: name });
              },
            });
          },
        }).addTo(map);

        countyLayerRef.current.bringToBack();
        setMapReady(true);
      })
      .catch((err) => {
        console.warn("TaiwanOutfitMap counties:", err);
        setMapReady(true);
      });

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.invalidateSize();
      }, 120);
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      countyLayerRef.current = null;
      districtLayerRef.current = null;
      countyBoundsRef.current.clear();
      districtBoundsRef.current.clear();
      taipeiBoundsRef.current = null;
      userDistrictMarkerRef.current?.remove();
      userDistrictMarkerRef.current = null;
      districtLabelsLayerRef.current?.clearLayers();
      districtLabelsLayerRef.current = null;
      initialFocusDone.current = false;
      setMapReady(false);
      setDistrictsReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const syncZoom = () => {
      const zoom = map.getZoom();
      const overTaipei = mapViewportCoversTaipei(map);
      const wantDistricts = zoom >= TAIPEI_DISTRICTS_MIN_ZOOM && overTaipei;

      if (wantDistricts) {
        if (mapInteractionRef.current.mapView !== "taipei-districts") {
          mapInteractionRef.current.onMapViewChange("taipei-districts");
        }
        setDistrictsVisibleByZoom(true);
      } else {
        setDistrictsVisibleByZoom(false);
      }
    };

    syncZoom();
    map.on("zoomend", syncZoom);
    map.on("moveend", syncZoom);
    return () => {
      map.off("zoomend", syncZoom);
      map.off("moveend", syncZoom);
    };
  }, [mapReady, mapViewportCoversTaipei]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (mapView === "taipei-districts") {
      void loadDistrictLayer(map).then(() => {
        syncDistrictLayerVisibility();
        applyCountyStyles();
        applyDistrictStyles();
        syncDistrictNameLabels();
      });
    } else {
      if (districtLayerRef.current) {
        map.removeLayer(districtLayerRef.current);
        districtLayerRef.current = null;
        setDistrictsReady(false);
      }
      setDistrictsVisibleByZoom(false);
      syncDistrictNameLabels();
      applyCountyStyles();
    }
  }, [
    mapView,
    mapReady,
    loadDistrictLayer,
    syncDistrictLayerVisibility,
    applyCountyStyles,
    applyDistrictStyles,
    syncDistrictNameLabels,
  ]);

  useEffect(() => {
    syncDistrictLayerVisibility();
    applyCountyStyles();
    if (districtsReady) {
      applyDistrictStyles();
      syncDistrictNameLabels();
    }
  }, [
    showDistrictLayers,
    districtsReady,
    syncDistrictLayerVisibility,
    applyCountyStyles,
    applyDistrictStyles,
    syncDistrictNameLabels,
    regionColorFills,
  ]);

  useEffect(() => {
    syncDistrictNameLabels();
  }, [syncDistrictNameLabels, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const showLabel = showDistrictLayers && districtsReady && !!userDistrict;

    if (!showLabel) {
      userDistrictMarkerRef.current?.remove();
      userDistrictMarkerRef.current = null;
      return;
    }

    const [lat, lon] = TAIPEI_DISTRICT_CENTROIDS[userDistrict];
    const icon = userDistrictLabelIcon(userDistrict);

    if (userDistrictMarkerRef.current) {
      userDistrictMarkerRef.current.setLatLng([lat, lon]);
      userDistrictMarkerRef.current.setIcon(icon);
    } else {
      userDistrictMarkerRef.current = L.marker([lat, lon], {
        icon,
        interactive: false,
        zIndexOffset: 400,
      }).addTo(map);
    }
  }, [showDistrictLayers, districtsReady, mapReady, userDistrict]);

  useEffect(() => {
    if (!mapReady || initialFocusDone.current) return;

    if (mapView === "taipei-districts" && taipeiBoundsRef.current) {
      focusBounds(taipeiBoundsRef.current, 12);
      initialFocusDone.current = true;
      return;
    }

    if (userCounty) {
      const b = countyBoundsRef.current.get(userCounty);
      if (b) focusBounds(b, userCounty === TAIPEI_COUNTY ? 11 : 10);
      initialFocusDone.current = true;
    } else {
      mapRef.current?.fitBounds(TAIWAN_MAP_BOUNDS, { padding: [12, 12] });
      initialFocusDone.current = true;
    }
  }, [
    mapReady,
    mapView,
    userCounty,
    userDistrict,
    focusBounds,
    onMapViewChange,
  ]);

  useEffect(() => {
    if (!mapReady) {
      lastFocusedRegionKeyRef.current = null;
      return;
    }
    if (!selectedRegion) {
      lastFocusedRegionKeyRef.current = null;
      return;
    }

    const key = regionKey(selectedRegion);
    if (lastFocusedRegionKeyRef.current === key) return;
    lastFocusedRegionKeyRef.current = key;

    if (selectedRegion.level === "district") {
      focusDistrict(selectedRegion.district);
      return;
    }

    if (selectedRegion.level === "county") {
      if (selectedRegion.county === TAIPEI_COUNTY && mapView === "taipei-districts") {
        if (taipeiBoundsRef.current) {
          focusBounds(taipeiBoundsRef.current, TAIPEI_DISTRICTS_MIN_ZOOM - 1);
        }
        return;
      }
      const b = countyBoundsRef.current.get(selectedRegion.county);
      if (b) focusBounds(b, 10);
    }
  }, [selectedRegion, mapView, mapReady, focusBounds, focusDistrict, districtsReady]);

  const displayLabel = selectedRegion
    ? regionLabel(selectedRegion)
    : userDistrict
      ? `${TAIPEI_COUNTY} ${userDistrict}`
      : userCounty ?? undefined;

  return (
    <section className="taiwan-outfit-map flex min-h-0 flex-1 flex-col" aria-label="台灣穿搭地圖">
      <div className="taiwan-outfit-map__frame relative min-h-0 flex-1 overflow-hidden rounded-3xl">
        <div ref={containerRef} className="taiwan-outfit-map__canvas h-full w-full" />

        <MapWeatherOverlay
          weather={weather}
          loading={weatherLoading}
          regionName={displayLabel}
        />

        {!selectedRegion && mapReady ? (
          <p className="map-county-hint pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] font-medium leading-snug text-stone-500">
            <span className="block">填色為該區域穿搭排行第一顏色</span>
            <span className="mt-0.5 block">
              {mapView === "taipei-districts"
                ? showDistrictLayers
                  ? "可點選行政區查看詳細數據；縮小地圖可改選台北市全區"
                  : "放大地圖至台北市範圍以顯示行政區"
                : "可點選縣市查看詳細數據；放大台北市可顯示行政區"}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
