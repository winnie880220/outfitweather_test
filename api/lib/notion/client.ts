import { env } from "../env";

export const NOTION_VERSION = "2022-06-28";

export async function notionRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.notionApiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "message" in data && data.message
        ? String(data.message)
        : `Notion API ${res.status}`;
    throw new Error(message);
  }
  return data;
}
