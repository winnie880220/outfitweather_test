import type { NotionRecordPayload } from "../../../src/types/api";
import { RECORDS_DB } from "./schema";

type NotionProps = Record<string, unknown>;

const richText = (value: string) => ({
  rich_text: [{ text: { content: value } }],
});

const multiSelect = (values: string[]) => ({
  multi_select: values.filter(Boolean).map((name) => ({ name })),
});

/** 將 App payload 轉成 Notion pages.create / pages.update 的 properties */
export function toNotionProperties(payload: NotionRecordPayload): NotionProps {
  const props: NotionProps = {};

  if (payload.userName !== undefined) {
    props[RECORDS_DB.userName] = {
      title: [{ text: { content: payload.userName } }],
    };
  }
  if (payload.location !== undefined) {
    props[RECORDS_DB.location] = richText(payload.location);
  }
  if (payload.startedAt !== undefined) {
    props[RECORDS_DB.startedAt] = {
      date: { start: payload.startedAt },
    };
  }
  if (payload.weather !== undefined) {
    props[RECORDS_DB.weather] = {
      select: payload.weather ? { name: payload.weather } : null,
    };
  }
  if (payload.temperature !== undefined) {
    props[RECORDS_DB.temperature] = { number: payload.temperature };
  }
  if (payload.maxTemp !== undefined) {
    props[RECORDS_DB.maxTemp] = richText(payload.maxTemp);
  }
  if (payload.minTemp !== undefined) {
    props[RECORDS_DB.minTemp] = { number: payload.minTemp };
  }
  if (payload.apparentTemp !== undefined) {
    props[RECORDS_DB.apparentTemp] = richText(String(payload.apparentTemp));
  }
  if (payload.humidity !== undefined) {
    props[RECORDS_DB.humidity] = { number: payload.humidity };
  }
  if (payload.rainProb !== undefined) {
    props[RECORDS_DB.rainProb] = { number: payload.rainProb };
  }
  if (payload.uvIndex !== undefined) {
    props[RECORDS_DB.uvIndex] = { number: payload.uvIndex };
  }
  if (payload.upperBodyTags !== undefined) {
    props[RECORDS_DB.upperBodyTags] = multiSelect(payload.upperBodyTags);
  }
  if (payload.lowerBodyTags !== undefined) {
    props[RECORDS_DB.lowerBodyTags] = multiSelect(payload.lowerBodyTags);
  }
  if (payload.breathability !== undefined) {
    props[RECORDS_DB.breathability] = { number: payload.breathability };
  }
  if (payload.wrapping !== undefined) {
    props[RECORDS_DB.wrapping] = { number: payload.wrapping };
  }
  if (payload.stuffiness !== undefined) {
    props[RECORDS_DB.stuffiness] = { number: payload.stuffiness };
  }
  if (payload.photoUrl) {
    props[RECORDS_DB.photo] = {
      files: [{ type: "external", name: "outfit", external: { url: payload.photoUrl } }],
    };
  }

  return props;
}
