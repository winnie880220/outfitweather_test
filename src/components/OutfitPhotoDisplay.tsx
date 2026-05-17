/** 穿搭照片：完整顯示（不裁切），無照片時顯示 emoji */
export function OutfitPhotoDisplay({
  photoUrl,
  emoji,
  bg = "#ebe6dc",
  className = "",
}: {
  photoUrl?: string;
  emoji: string;
  bg?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ backgroundColor: photoUrl ? "#f3f0eb" : bg }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="穿搭"
          className="absolute inset-0 w-full h-full object-contain object-center"
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
