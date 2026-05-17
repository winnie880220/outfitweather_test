export type ParsedImage = {
  base64: string;
  mimeType: string;
  previewUrl: string;
};

/** 將 data URL 壓縮後回傳 base64（供 API 上傳） */
export function compressDataUrl(
  dataUrl: string,
  maxWidth = 1280,
  quality = 0.85
): Promise<ParsedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("無法處理圖片"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const previewUrl = canvas.toDataURL("image/jpeg", quality);
      const match = previewUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        reject(new Error("圖片格式錯誤"));
        return;
      }
      resolve({
        mimeType: match[1],
        base64: match[2],
        previewUrl,
      });
    };
    img.onerror = () => reject(new Error("圖片載入失敗"));
    img.src = dataUrl;
  });
}

/** 從 video 擷取畫面 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  maxWidth = 1280
): Promise<ParsedImage> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return Promise.reject(new Error("相機尚未就緒"));
  }
  const scale = Math.min(1, maxWidth / w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("無法擷取畫面"));
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const previewUrl = canvas.toDataURL("image/jpeg", 0.85);
  const match = previewUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return Promise.reject(new Error("擷取失敗"));
  }
  return Promise.resolve({
    mimeType: match[1],
    base64: match[2],
    previewUrl,
  });
}
