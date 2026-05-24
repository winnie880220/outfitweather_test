import {
  TAIPEI_COUNTY,
  TAIPEI_DISTRICTS,
  TAIPEI_WHOLE_AREA,
  TAIWAN_COUNTIES,
  type LocationPickerValue,
  type TaipeiPickerDistrict,
} from "../../lib/location-picker";

export function LocationRegionPicker({
  value,
  onChange,
  compact = false,
  locating = false,
  onRequestLocate,
}: {
  value: LocationPickerValue;
  onChange: (next: LocationPickerValue) => void;
  compact?: boolean;
  locating?: boolean;
  onRequestLocate?: () => void;
}) {
  const showDistrict = value.county === TAIPEI_COUNTY;

  return (
    <div
      className={`location-region-picker${compact ? " location-region-picker--compact location-region-picker--inline" : ""}`}
    >
      <div className="location-region-picker__row">
        <label className="location-region-picker__label" htmlFor="region-county">
          地區
        </label>
        <select
          id="region-county"
          className="location-region-picker__select"
          value={value.county}
          onChange={(e) => {
            const county = e.target.value as LocationPickerValue["county"];
            if (county === TAIPEI_COUNTY) {
              onChange({
                county,
                district: value.district ?? TAIPEI_WHOLE_AREA,
              });
            } else {
              onChange({ county });
            }
          }}
        >
          {TAIWAN_COUNTIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {showDistrict ? (
        <div className="location-region-picker__row">
          <label className="location-region-picker__label" htmlFor="region-district">
            行政區
          </label>
          <select
            id="region-district"
            className="location-region-picker__select"
            value={value.district ?? TAIPEI_WHOLE_AREA}
            onChange={(e) => {
              onChange({
                county: TAIPEI_COUNTY,
                district: e.target.value as TaipeiPickerDistrict,
              });
            }}
          >
            <option value={TAIPEI_WHOLE_AREA}>全區</option>
            {TAIPEI_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {onRequestLocate ? (
        <div
          className={`location-region-picker__alt${compact ? " location-region-picker__alt--stacked" : ""}`}
        >
          {compact ? (
            <span className="location-region-picker__label location-region-picker__label--or">
              或
            </span>
          ) : (
            <span className="location-region-picker__or" aria-hidden="true">
              或
            </span>
          )}
          <button
            type="button"
            className="location-region-picker__locate"
            onClick={onRequestLocate}
            disabled={locating}
            aria-label={locating ? "定位中" : "使用目前定位"}
          >
            {locating ? "定位中…" : "使用目前定位"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
