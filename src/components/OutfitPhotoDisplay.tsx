import { useEffect, useState } from "react";

/** 穿搭照片：預設完整顯示；靈感卡可用 cover 填滿圖片區 */
export function OutfitPhotoDisplay({
  photoUrl,
  emoji,
  bg = "#ebe6dc",
  objectFit = "contain",
  className = "",
}: {
  photoUrl?: string;
  emoji: string;
  bg?: string;
  objectFit?: "contain" | "cover";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [photoUrl]);
  const imgFitClass = objectFit === "cover" ? "object-cover" : "object-contain";
  const showPhoto = Boolean(photoUrl) && !broken;

  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden ${className}`}
      style={{ backgroundColor: showPhoto ? "#f3f0eb" : bg }}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt="穿搭"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`absolute inset-0 block h-full w-full ${imgFitClass} object-center`}
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-8xl select-none">
          {emoji}
        </div>
      )}
    </div>
  );
}
