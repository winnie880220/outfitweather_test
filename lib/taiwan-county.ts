/** 台灣縣市：前後端共用（解析 Location 字串、地圖座標） */

import { parseTaipeiDistrict } from "./taipei-district";

export const TAIWAN_COUNTIES = [
  "新北市",
  "台北市",
  "桃園市",
  "台中市",
  "台南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "台東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
] as const;

export type TaiwanCounty = (typeof TAIWAN_COUNTIES)[number];

/** WGS84 [lat, lon]，由 counties-10t TopoJSON 質心計算 */
export const COUNTY_CENTROIDS: Record<TaiwanCounty, [number, number]> = {
  連江縣: [26.196132264263444, 120.07666549784133],
  宜蘭縣: [24.62698479509627, 121.67629182623303],
  彰化縣: [23.950458979382216, 120.536020939596],
  南投縣: [23.85561933598018, 120.95007627941293],
  雲林縣: [23.589075752367958, 120.2974035999985],
  基隆市: [25.126211786900672, 121.73228294386189],
  台北市: [25.073214027661543, 121.57044951447008],
  新北市: [25.011285421511523, 121.60572086929606],
  台中市: [24.245582501619374, 120.98070133820883],
  台南市: [23.16708137737432, 120.37789738320174],
  桃園市: [24.890307750170738, 121.29008445287833],
  苗栗縣: [24.50279172619304, 120.97161706637748],
  嘉義市: [23.483367910522034, 120.44832135297213],
  嘉義縣: [23.43452129506497, 120.52615468709621],
  金門縣: [24.482259014906365, 118.42490884235305],
  高雄市: [23.0367531299001, 120.64120049818906],
  台東縣: [22.83041072096087, 121.14302295341983],
  花蓮縣: [23.75281417833596, 121.3618582501906],
  澎湖縣: [23.52988152465936, 119.56094443347935],
  新竹市: [24.77256271878543, 120.95433535702635],
  新竹縣: [24.69418719071425, 121.13974324876897],
  屏東縣: [22.403505562596308, 120.72443030385247],
};

const COUNTY_SET = new Set<string>(TAIWAN_COUNTIES);

export function isTaiwanCounty(name: string): name is TaiwanCounty {
  return COUNTY_SET.has(name);
}

/** 統一 Location 字串（臺→台、去多餘空白） */
export function normalizeLocationText(location: string): string {
  return location.replace(/臺/g, "台").replace(/\s+/g, " ").trim();
}

/** 是否屬於台北市（含臺北市、台北市大安區、僅行政區名等） */
export function isTaipeiCityLocation(location: string): boolean {
  return parseLocationToCounty(location) === "台北市";
}

/** 從 Notion Location／反向地理編碼字串解析縣市 */
export function parseLocationToCounty(location: string): TaiwanCounty | null {
  const text = normalizeLocationText(location);
  if (!text) return null;

  const compact = text.replace(/\s/g, "");
  if (compact.includes("台北市")) return "台北市";
  if (parseTaipeiDistrict(text)) return "台北市";
  if (/^台北(市)?/.test(compact) && !compact.includes("新北")) return "台北市";

  for (const county of TAIWAN_COUNTIES) {
    if (text.includes(county)) return county;
  }

  const districtToCounty: Record<string, TaiwanCounty> = {
    台北: "台北市",
    臺北: "台北市",
    新北: "新北市",
    桃園: "桃園市",
    台中: "台中市",
    臺中: "台中市",
    台南: "台南市",
    臺南: "台南市",
    高雄: "高雄市",
    基隆: "基隆市",
    新竹: "新竹市",
    苗栗: "苗栗縣",
    彰化: "彰化縣",
    南投: "南投縣",
    雲林: "雲林縣",
    嘉義: "嘉義市",
    屏東: "屏東縣",
    宜蘭: "宜蘭縣",
    花蓮: "花蓮縣",
    台東: "台東縣",
    臺東: "台東縣",
    澎湖: "澎湖縣",
    金門: "金門縣",
    連江: "連江縣",
    馬祖: "連江縣",
  };

  for (const [key, county] of Object.entries(districtToCounty)) {
    if (text.includes(key)) return county;
  }

  return null;
}
