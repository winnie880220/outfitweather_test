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
  if (node.classList.contains("style-note-card__export-photo-helper")) {
    return false;
  }
  if (
    node.tagName === "IMG" &&
    node.classList.contains("opacity-0") &&
    node.offsetWidth === 0
  ) {
    return false;
  }
  return true;
}

function readPhotoSrc(element: HTMLElement): string | undefined {
  const bg = element.querySelector<HTMLElement>(".style-note-card__export-photo-bg");
  const fromBg = bg?.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
  if (fromBg) return fromBg;
  return element.querySelector<HTMLImageElement>(".style-note-card__export-photo-helper")
    ?.src;
}

type PhotoRegion = { dx: number; dy: number; dw: number; dh: number };

function measurePhotoRegion(element: HTMLElement): PhotoRegion | null {
  const cardRect = element.getBoundingClientRect();
  const photoEl = element.querySelector(".style-note-card__polaroid-photo");
  if (!photoEl) return null;
  const rect = photoEl.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return {
    dx: rect.left - cardRect.left,
    dy: rect.top - cardRect.top,
    dw: rect.width,
    dh: rect.height,
  };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const dataUrl = await ensureDataUrl(src);
  const img = new Image();
  img.decoding = "sync";
  img.src = dataUrl;
  await img.decode();
  return img;
}

/** 擷取前僅 inline 圖片，不調整版面（避免陰影／拍立得框位移） */
export async function prepareShareCardForCapture(
  element: HTMLElement,
  photoDataUrl?: string
): Promise<void> {
  element.setAttribute("data-capturing", "true");

  const bgEl = element.querySelector<HTMLElement>(".style-note-card__export-photo-bg");
  const src = photoDataUrl ?? readPhotoSrc(element);
  if (src && bgEl) {
    try {
      const dataUrl = await ensureDataUrl(src);
      bgEl.style.backgroundImage = `url("${dataUrl}")`;
    } catch {
      if (src.startsWith("data:")) {
        bgEl.style.backgroundImage = `url("${src}")`;
      }
    }
  }

  const helper = element.querySelector<HTMLImageElement>(
    ".style-note-card__export-photo-helper"
  );
  if (helper && src) {
    try {
      helper.src = await ensureDataUrl(src);
      await helper.decode();
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

function samplePhotoPresent(
  cardImg: HTMLImageElement,
  region: PhotoRegion,
  cardCssWidth: number
): boolean {
  const scale = cardImg.width / Math.max(1, cardCssWidth);
  const sx = Math.max(0, Math.round(region.dx * scale));
  const sy = Math.max(0, Math.round(region.dy * scale));
  const sw = Math.min(32, Math.round(region.dw * scale));
  const sh = Math.min(32, Math.round(region.dh * scale));
  if (sw < 4 || sh < 4) return false;

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(cardImg, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;
  let nonBg = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 20) continue;
    if (!(r > 228 && g > 224 && b > 216)) nonBg += 1;
  }
  return nonBg > sw * sh * 0.06;
}

/** 僅在 toPng 未帶出照片時才合成，且用擷取前的區域座標 */
async function compositePhotoFallback(
  element: HTMLElement,
  pngDataUrl: string,
  photoDataUrl: string,
  region: PhotoRegion
): Promise<Blob> {
  const [cardImg, photoImg] = await Promise.all([
    loadImage(pngDataUrl),
    loadImage(photoDataUrl),
  ]);

  const cardCssWidth = element.getBoundingClientRect().width;
  const scale = cardImg.width / Math.max(1, cardCssWidth);
  const dx = Math.round(region.dx * scale);
  const dy = Math.round(region.dy * scale);
  const dw = Math.round(region.dw * scale);
  const dh = Math.round(region.dh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cardImg.width;
  canvas.height = cardImg.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const res = await fetch(pngDataUrl);
    return res.blob();
  }

  ctx.drawImage(cardImg, 0, 0);

  const fitScale = Math.min(dw / photoImg.width, dh / photoImg.height);
  const pw = Math.round(photoImg.width * fitScale);
  const ph = Math.round(photoImg.height * fitScale);
  const px = dx + Math.round((dw - pw) / 2);
  const py = dy + Math.round((dh - ph) / 2);
  ctx.drawImage(photoImg, px, py, pw, ph);

  const res = await fetch(canvas.toDataURL("image/png"));
  return res.blob();
}

export async function captureShareCardElement(
  element: HTMLElement,
  photoDataUrl?: string
): Promise<Blob> {
  const photoSrc = photoDataUrl ?? readPhotoSrc(element);
  const region = measurePhotoRegion(element);

  await prepareShareCardForCapture(element, photoSrc);

  try {
    const pixelRatio = computePixelRatio(element);
    const dataUrl = await toPng(element, {
      pixelRatio,
      backgroundColor: "#fffef9",
      cacheBust: true,
      skipAutoScale: true,
      filter: shouldIncludeNode,
    });

    const cardImg = await loadImage(dataUrl);
    const cardCssWidth = element.getBoundingClientRect().width;

    if (
      photoSrc &&
      region &&
      !samplePhotoPresent(cardImg, region, cardCssWidth)
    ) {
      const blob = await compositePhotoFallback(
        element,
        dataUrl,
        photoSrc,
        region
      );
      if (!blob.size) throw new Error("匯出失敗");
      return blob;
    }

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
