import { RECORDS_DB } from "./schema";

export type NotionProp = {
  type: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  number?: number | null;
  select?: { name: string } | null;
  multi_select?: Array<{ name: string }>;
  date?: { start?: string };
  files?: Array<{
    type?: string;
    name?: string;
    file?: { url?: string };
    external?: { url?: string };
  }>;
};

export type ParsedNotionRecord = {
  id: string;
  userName: string;
  location: string;
  startedAt?: string;
  weather?: string;
  temperature?: number;
  humidity?: number;
  rainProb?: number;
  apparentTemp?: string;
  upperBodyTags: string[];
  lowerBodyTags: string[];
  breathability?: number;
  wrapping?: number;
  stuffiness?: number;
  photoUrl?: string;
};

function plainText(prop?: NotionProp): string {
  if (!prop) return "";
  if (prop.type === "title") {
    return prop.title?.map((t) => t.plain_text ?? "").join("") ?? "";
  }
  if (prop.type === "rich_text") {
    return prop.rich_text?.map((t) => t.plain_text ?? "").join("") ?? "";
  }
  return "";
}

function fileUrl(prop?: NotionProp): string | undefined {
  if (!prop || prop.type !== "files" || !prop.files?.length) return undefined;
  const f = prop.files[0];
  return f.file?.url ?? f.external?.url;
}

export function parseNotionPage(page: {
  id: string;
  properties: Record<string, NotionProp>;
}): ParsedNotionRecord | null {
  const p = page.properties;
  const userName = plainText(p[RECORDS_DB.userName]);
  if (!userName) return null;

  const temperature = p[RECORDS_DB.temperature]?.number ?? undefined;
  const lowerSelect = p[RECORDS_DB.lowerBodyTags]?.select?.name;

  return {
    id: page.id,
    userName,
    location: plainText(p[RECORDS_DB.location]),
    startedAt: p[RECORDS_DB.startedAt]?.date?.start,
    weather: p[RECORDS_DB.weather]?.select?.name,
    temperature: temperature ?? undefined,
    humidity: p[RECORDS_DB.humidity]?.number ?? undefined,
    rainProb: p[RECORDS_DB.rainProb]?.number ?? undefined,
    apparentTemp: plainText(p[RECORDS_DB.apparentTemp]) || undefined,
    upperBodyTags: p[RECORDS_DB.upperBodyTags]?.multi_select?.map((t) => t.name) ?? [],
    lowerBodyTags: lowerSelect ? [lowerSelect] : [],
    breathability: p[RECORDS_DB.breathability]?.number ?? undefined,
    wrapping: p[RECORDS_DB.wrapping]?.number ?? undefined,
    stuffiness: p[RECORDS_DB.stuffiness]?.number ?? undefined,
    photoUrl: fileUrl(p[RECORDS_DB.photo]),
  };
}
