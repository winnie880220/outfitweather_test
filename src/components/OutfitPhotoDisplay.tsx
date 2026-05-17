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
  const imgFitClass = objectFit === "cover" ? "object-cover" : "object-contain";

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ backgroundColor: photoUrl ? "#f3f0eb" : bg }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="穿搭"
          className={`absolute inset-0 h-full w-full ${imgFitClass} object-center`}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-8xl select-none">
          {emoji}
        </div>
      )}
    </div>
  );
}

