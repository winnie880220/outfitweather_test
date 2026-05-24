import {
  TAIPEI_COUNTY,
  TAIPEI_DISTRICT_CENTROIDS,
  TAIPEI_DISTRICTS,
  parseTaipeiDistrict,
  type TaipeiDistrict,
} from "./taipei-district";
import {
  COUNTY_CENTROIDS,
  TAIWAN_COUNTIES,
  isTaiwanCounty,
  parseLocationToCounty,
  type TaiwanCounty,
} from "./taiwan-county";

/** 台北市選單：全區＝全市；其餘為單一行政區 */
export const TAIPEI_WHOLE_AREA = "全區" as const;

export type TaipeiPickerDistrict = TaipeiDistrict | typeof TAIPEI_WHOLE_AREA;

export type LocationPickerValue = {
  county: TaiwanCounty;
  district?: TaipeiPickerDistrict;
};

export function isTaipeiWholeAreaPicker(value: LocationPickerValue): boolean {
  return (
    value.county === TAIPEI_COUNTY &&
    (!value.district || value.district === TAIPEI_WHOLE_AREA)
  );
}

/** 台北市且非全區時，回傳行政區名稱 */
export function taipeiDistrictFromPicker(
  value: LocationPickerValue
): TaipeiDistrict | undefined {
  if (value.county !== TAIPEI_COUNTY) return undefined;
  if (!value.district || value.district === TAIPEI_WHOLE_AREA) return undefined;
  return value.district;
}

export function buildLocationLabel(value: LocationPickerValue): string {
  if (value.county === TAIPEI_COUNTY) {
    if (isTaipeiWholeAreaPicker(value)) return TAIPEI_COUNTY;
    return `${value.county} ${value.district}`;
  }
  return value.county;
}

export function buildUserLocationFromPicker(value: LocationPickerValue): {
  name: string;
  lat: number;
  lon: number;
} {
  const name = buildLocationLabel(value);
  const district = taipeiDistrictFromPicker(value);
  if (district) {
    const [lat, lon] = TAIPEI_DISTRICT_CENTROIDS[district];
    return { name, lat, lon };
  }
  const [lat, lon] = COUNTY_CENTROIDS[value.county];
  return { name, lat, lon };
}

/** 從定位／Location 字串還原選單值 */
export function parseLocationToPickerValue(
  locationName: string
): LocationPickerValue | null {
  const county = parseLocationToCounty(locationName);
  if (!county) return null;

  if (county === TAIPEI_COUNTY) {
    const district = parseTaipeiDistrict(locationName);
    return district
      ? { county, district }
      : { county, district: TAIPEI_WHOLE_AREA };
  }

  return { county };
}

export function isSamePickerValue(
  a: LocationPickerValue,
  b: LocationPickerValue
): boolean {
  return a.county === b.county && a.district === b.district;
}

export {
  TAIWAN_COUNTIES,
  TAIPEI_COUNTY,
  TAIPEI_DISTRICTS,
  isTaiwanCounty,
  type TaipeiDistrict,
};
