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

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("無法讀取圖片"));
    reader.readAsDataURL(blob);
  });
}

async function ensureDataUrl(src: string): Promise<string> {
  if (!src) return src;
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error("圖片載入失敗");
  return blobToDataUrl(await res.blob());
}

/** 提交回饋時先固定 data URL，避免 iOS 撤銷 blob 後匯出空白 */
export async function resolveSharePhotoDataUrl(
  sources: Array<string | undefined | null>
): Promise<string | undefined> {
  for (const src of sources) {
    if (!src) continue;
    if (src.startsWith("data:")) return src;
  }

  for (const src of sources) {
    if (!src) continue;
    try {
      return await ensureDataUrl(src);
    } catch {
      /* try next source */
    }
  }

  return sources.find((src): src is string => Boolean(src));
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

/** 擷取前：inline 圖片 data URL */
export async function prepareShareCardForCapture(
  element: HTMLElement,
  photoDataUrl?: string
): Promise<void> {
  element.setAttribute("data-capturing", "true");

  const img = element.querySelector<HTMLImageElement>(".style-note-card__export-photo");
  const src = photoDataUrl ?? img?.src;

  if (src && img) {
    const dataUrl = src.startsWith("data:")
      ? src
      : await ensureDataUrl(src).catch(() => src);
    img.src = dataUrl;
    try {
      await img.decode();
    } catch {
      /* optional */
    }
  }

  await document.fonts.ready;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function releaseShareCardCaptureState(element: HTMLElement): void {
  element.removeAttribute("data-capturing");
}

export async function captureShareCardElement(
  element: HTMLElement,
  photoDataUrl?: string
): Promise<Blob> {
  await prepareShareCardForCapture(element, photoDataUrl);

  try {
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
  } finally {
    releaseShareCardCaptureState(element);
  }
}

function defaultFilename(): string {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `outfit-feel-${stamp}.png`;
}

export async function downloadShareCardElement(
  element: HTMLElement,
  photoDataUrl?: string,
  filename?: string
): Promise<void> {
  const blob = await captureShareCardElement(element, photoDataUrl);
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
