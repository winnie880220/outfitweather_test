import { toPng } from "html-to-image";

export type FeedbackShareFeelMetrics = {
  breathability: number;
  snugness: number;
  stuffiness: number;
};

/** 分享／下載卡片固定直式 9:16（寬:高），使用者稱「16:9 直式」 */
export const SHARE_CARD_ASPECT_WIDTH = 9;
export const SHARE_CARD_ASPECT_HEIGHT = 16;

/** 匯出為直式 9:16，高邊目標 1920px */
const EXPORT_HEIGHT_9X16 = 1920;
const MIN_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO = 5;

function computePixelRatio(element: HTMLElement): number {
  const ratio = EXPORT_HEIGHT_9X16 / Math.max(1, element.offsetHeight);
  return Math.min(MAX_PIXEL_RATIO, Math.max(MIN_PIXEL_RATIO, ratio));
}

function shouldIncludeNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return true;
  if (
    node.tagName === "IMG" &&
    node.classList.contains("opacity-0") &&
    node.offsetWidth === 0
  ) {
    return false;
  }
  return true;
}

export async function captureShareCardElement(
  element: HTMLElement
): Promise<Blob> {
  await document.fonts.ready;

  const pixelRatio = computePixelRatio(element);
  const dataUrl = await toPng(element, {
    pixelRatio,
    backgroundColor: "#fffef9",
    cacheBust: true,
    skipAutoScale: true,
    filter: shouldIncludeNode,
  });

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (!blob.size) throw new Error("匯出失敗");
  return blob;
}

function defaultFilename(): string {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `outfit-feel-${stamp}.png`;
}

export async function downloadShareCardElement(
  element: HTMLElement,
  filename?: string
): Promise<void> {
  const blob = await captureShareCardElement(element);
  const file = new File([blob], filename ?? defaultFilename(), {
    type: "image/png",
  });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "我的穿搭體感" });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      throw err;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}
