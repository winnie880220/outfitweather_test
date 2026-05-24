import {
  taipeiDistrictFromPicker,
  type LocationPickerValue,
} from "./location-picker";
import {
  parseTaipeiDistrict,
  TAIPEI_COUNTY,
  TAIPEI_DISTRICT_CENTROIDS,
  type TaipeiDistrict,
} from "./taipei-district";
import {
  COUNTY_CENTROIDS,
  parseLocationToCounty,
  type TaiwanCounty,
} from "./taiwan-county";

export type MapRegion =
  | { level: "county"; county: TaiwanCounty }
  | { level: "district"; county: typeof TAIPEI_COUNTY; district: TaipeiDistrict };

/** 台北市全市（首頁「全區」、地圖「看台北市穿搭靈感」） */
export const TAIPEI_WHOLE_REGION: MapRegion = {
  level: "county",
  county: TAIPEI_COUNTY,
};

export function parseLocationToRegion(location: string): MapRegion | null {
  const county = parseLocationToCounty(location);
  if (!county) return null;

  if (county === TAIPEI_COUNTY) {
    const district = parseTaipeiDistrict(location);
    if (district) {
      return { level: "district", county: TAIPEI_COUNTY, district };
    }
  }

  return { level: "county", county };
}

export function regionKey(region: MapRegion): string {
  if (region.level === "district") return `${region.county}:${region.district}`;
  return region.county;
}

export function regionLabel(region: MapRegion): string {
  if (region.level === "district") return `${region.county} ${region.district}`;
  return region.county;
}

/** 首頁地區選單 → 地圖／靈感區域（台北市「全區」＝全市） */
export function locationPickerToRegion(picker: LocationPickerValue): MapRegion {
  if (picker.county === TAIPEI_COUNTY) {
    const district = taipeiDistrictFromPicker(picker);
    if (district) {
      return { level: "district", county: TAIPEI_COUNTY, district };
    }
    return { level: "county", county: TAIPEI_COUNTY };
  }
  return { level: "county", county: picker.county };
}

export function isSameRegion(a: MapRegion | null, b: MapRegion | null): boolean {
  if (!a || !b) return false;
  return regionKey(a) === regionKey(b);
}

/** 地圖選取區域的質心與顯示名稱（用於該區天氣） */
export function mapRegionToLocation(region: MapRegion): {
  lat: number;
  lon: number;
  name: string;
} {
  const name = regionLabel(region);
  if (region.level === "district") {
    const [lat, lon] = TAIPEI_DISTRICT_CENTROIDS[region.district];
    return { lat, lon, name };
  }
  const [lat, lon] = COUNTY_CENTROIDS[region.county];
  return { lat, lon, name };
}
