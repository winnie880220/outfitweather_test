import type { InspirationItem } from "./api/outfit-insights";

/** 靈感／收藏卡片是否帶有可顯示的穿搭照片 URL */
export function inspirationCardHasPhoto(card: InspirationItem): boolean {
  return Boolean(card.photoUrl?.trim());
}

export function filterInspirationCardsWithPhoto(
  cards: InspirationItem[]
): InspirationItem[] {
  return cards.filter(inspirationCardHasPhoto);
}
