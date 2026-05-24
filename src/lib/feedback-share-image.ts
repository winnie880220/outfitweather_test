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

async function loadImage(src: string): Promise<HTMLImageElement> {
  const dataUrl = await ensureDataUrl(src);
  const img = new Image();
  img.decoding = "sync";
  img.src = dataUrl;
  await img.decode();
  return img;
}

/** iOS Safari：html-to-image 需 inline data URL；照片用 background-image 較穩定 */
export async function prepareShareCardForCapture(element: HTMLElement): Promise<void> {
  element.setAttribute("data-capturing", "true");

  const photoSrc =
    element
      .querySelector<HTMLElement>(".style-note-card__export-photo-bg")
      ?.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1] ??
    element.querySelector<HTMLImageElement>(".style-note-card__export-photo-helper")?.src;

  let dataUrl: string | undefined;
  if (photoSrc) {
    try {
      dataUrl = await ensureDataUrl(photoSrc);
    } catch {
      dataUrl = photoSrc.startsWith("data:") ? photoSrc : undefined;
    }
  }

  const polaroidPhoto = element.querySelector<HTMLElement>(
    ".style-note-card__polaroid-photo"
  );
  const bgEl = element.querySelector<HTMLElement>(".style-note-card__export-photo-bg");

  if (dataUrl && bgEl) {
    bgEl.style.backgroundImage = `url("${dataUrl}")`;
    const img = await loadImage(dataUrl);
    const boxW = Math.max(polaroidPhoto?.clientWidth ?? 0, bgEl.clientWidth, 120);
    const boxH = Math.max(polaroidPhoto?.clientHeight ?? 0, bgEl.clientHeight, 160);
    bgEl.style.width = `${boxW}px`;
    bgEl.style.height = `${boxH}px`;
    bgEl.style.minHeight = `${boxH}px`;
    bgEl.style.backgroundSize = "contain";
    bgEl.style.backgroundPosition = "center";
    bgEl.style.backgroundRepeat = "no-repeat";
    if (polaroidPhoto) {
      polaroidPhoto.style.minHeight = `${boxH}px`;
    }
    void img;
  }

  const imgs = Array.from(
    element.querySelectorAll<HTMLImageElement>(".style-note-card__export-photo-helper")
  );
  await Promise.all(
    imgs.map(async (img) => {
      if (!img.src || !dataUrl) return;
      img.src = dataUrl;
      try {
        await img.decode();
      } catch {
        /* helper only */
      }
    })
  );

  await document.fonts.ready;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function releaseShareCardCaptureState(element: HTMLElement): void {
  element.removeAttribute("data-capturing");
  element.querySelectorAll<HTMLElement>(".style-note-card__export-photo-bg").forEach((el) => {
    el.style.removeProperty("width");
    el.style.removeProperty("height");
    el.style.removeProperty("min-height");
  });
  element.querySelectorAll<HTMLElement>(".style-note-card__polaroid-photo").forEach((el) => {
    el.style.removeProperty("min-height");
  });
}

async function compositePhotoOntoPng(
  element: HTMLElement,
  pngDataUrl: string,
  photoDataUrl: string
): Promise<Blob> {
  const [cardImg, photoImg] = await Promise.all([
    loadImage(pngDataUrl),
    loadImage(photoDataUrl),
  ]);

  const bgEl = element.querySelector<HTMLElement>(".style-note-card__export-photo-bg");
  const cardRect = element.getBoundingClientRect();
  const bgRect = bgEl?.getBoundingClientRect();
  if (!bgRect || bgRect.width < 1 || bgRect.height < 1) {
    const res = await fetch(pngDataUrl);
    return res.blob();
  }

  const scale = cardImg.width / Math.max(1, cardRect.width);
  const dx = Math.round((bgRect.left - cardRect.left) * scale);
  const dy = Math.round((bgRect.top - cardRect.top) * scale);
  const dw = Math.round(bgRect.width * scale);
  const dh = Math.round(bgRect.height * scale);

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

  const photoCanvas = document.createElement("canvas");
  photoCanvas.width = dw;
  photoCanvas.height = dh;
  const photoCtx = photoCanvas.getContext("2d");
  if (!photoCtx) {
    const res = await fetch(pngDataUrl);
    return res.blob();
  }
  photoCtx.fillStyle = "#f3f0eb";
  photoCtx.fillRect(0, 0, dw, dh);
  photoCtx.drawImage(
    photoImg,
    Math.round((dw - pw) / 2),
    Math.round((dh - ph) / 2),
    pw,
    ph
  );

  const region = ctx.getImageData(dx, dy, dw, dh);
  const photoData = photoCtx.getImageData(0, 0, dw, dh);
  const isBg = (r: number, g: number, b: number, a: number) => {
    if (a < 16) return true;
    return r > 228 && g > 224 && b > 216 && r - b < 28;
  };

  for (let i = 0; i < region.data.length; i += 4) {
    const r = region.data[i];
    const g = region.data[i + 1];
    const b = region.data[i + 2];
    const a = region.data[i + 3];
    if (isBg(r, g, b, a)) {
      region.data[i] = photoData.data[i];
      region.data[i + 1] = photoData.data[i + 1];
      region.data[i + 2] = photoData.data[i + 2];
      region.data[i + 3] = photoData.data[i + 3];
    }
  }

  ctx.putImageData(region, dx, dy);

  const res = await fetch(canvas.toDataURL("image/png"));
  return res.blob();
}

export async function captureShareCardElement(
  element: HTMLElement
): Promise<Blob> {
  const photoSrc =
    element
      .querySelector<HTMLElement>(".style-note-card__export-photo-bg")
      ?.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1] ??
    element.querySelector<HTMLImageElement>(".style-note-card__export-photo-helper")?.src;

  await prepareShareCardForCapture(element);

  try {
    const pixelRatio = computePixelRatio(element);
    const dataUrl = await toPng(element, {
      pixelRatio,
      backgroundColor: "#fffef9",
      cacheBust: true,
      skipAutoScale: true,
      filter: shouldIncludeNode,
    });

    let blob: Blob;
    if (photoSrc) {
      try {
        const photoDataUrl = await ensureDataUrl(photoSrc);
        blob = await compositePhotoOntoPng(element, dataUrl, photoDataUrl);
      } catch {
        const res = await fetch(dataUrl);
        blob = await res.blob();
      }
    } else {
      const res = await fetch(dataUrl);
      blob = await res.blob();
    }

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
