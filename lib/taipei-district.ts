/** 台北市 12 行政區 */

export const TAIPEI_DISTRICTS = [
  "中正區",
  "大同區",
  "中山區",
  "松山區",
  "大安區",
  "萬華區",
  "信義區",
  "士林區",
  "北投區",
  "內湖區",
  "南港區",
  "文山區",
] as const;

export type TaipeiDistrict = (typeof TAIPEI_DISTRICTS)[number];

export const TAIPEI_COUNTY = "台北市" as const;

/** WGS84 [lat, lon] */
export const TAIPEI_DISTRICT_CENTROIDS: Record<TaipeiDistrict, [number, number]> = {
  大安區: [25.026842643082666, 121.54687390384095],
  文山區: [24.995641565240206, 121.57417668224774],
  信義區: [25.023785007190963, 121.56765981420699],
  萬華區: [25.02721615592588, 121.4945829432011],
  中正區: [25.020909749701765, 121.52391063290918],
  南港區: [25.030636417101956, 121.6284942037066],
  松山區: [25.05786884350086, 121.55933836636736],
  大同區: [25.06403541162792, 121.50804395630531],
  中山區: [25.071050080448984, 121.5417640529404],
  內湖區: [25.08801303554481, 121.6100943649571],
  士林區: [25.133585082074248, 121.54981906023298],
  北投區: [25.16615520602236, 121.51708260169583],
};

const DISTRICT_SET = new Set<string>(TAIPEI_DISTRICTS);

export function isTaipeiDistrict(name: string): name is TaipeiDistrict {
  return DISTRICT_SET.has(name);
}

/** 從 Location 字串解析台北市行政區 */
export function parseTaipeiDistrict(location: string): TaipeiDistrict | null {
  const text = location.replace(/臺/g, "台").trim();
  if (!text) return null;

  const sorted = [...TAIPEI_DISTRICTS].sort((a, b) => b.length - a.length);
  for (const district of sorted) {
    if (text.includes(district)) return district;
  }

  const shortAliases: Record<string, TaipeiDistrict> = {
    大安: "大安區",
    信義: "信義區",
    中山: "中山區",
    松山: "松山區",
    萬華: "萬華區",
    中正: "中正區",
    大同: "大同區",
    士林: "士林區",
    北投: "北投區",
    內湖: "內湖區",
    南港: "南港區",
    文山: "文山區",
  };

  for (const [key, district] of Object.entries(shortAliases)) {
    if (text.includes(key)) return district;
  }

  return null;
}

export function formatRegionLabel(county: string, district?: string | null): string {
  if (district) return `${county} ${district}`;
  return county;
}
