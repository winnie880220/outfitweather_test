export function getRecordIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("record");
}

export function buildRecordUrl(pageId: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("record", pageId);
  return url.toString();
}

export function clearRecordFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("record")) return;
  url.searchParams.delete("record");
  const next = url.pathname + url.search + url.hash;
  window.history.replaceState({}, "", next);
}
