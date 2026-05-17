import { MapPin } from "lucide-react";
import { OutfitPhotoDisplay } from "./OutfitPhotoDisplay";

export type FeedbackOutfitContext = {
  photoUrl?: string;
  locationName?: string;
  temp?: number;
  condition?: string;
  recordedTime?: string;
};

function formatLocation(name?: string): string | null {
  if (!name?.trim()) return null;
  const parts = name.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  return parts[0] || name;
}

export function FeedbackOutfitCard({
  outfit,
  className = "mx-4 mb-4",
}: {
  outfit: FeedbackOutfitContext;
  className?: string;
}) {
  const location = formatLocation(outfit.locationName);
  const weatherLabel =
    outfit.temp !== undefined
      ? `${Math.round(outfit.temp)}°C${outfit.condition ? ` ${outfit.condition}` : ""}`
      : outfit.condition || null;

  const detailParts = [
    outfit.recordedTime ? `${outfit.recordedTime} 拍攝` : null,
    location,
    weatherLabel,
  ].filter(Boolean);

  const showFullAddress =
    outfit.locationName && location && outfit.locationName.length > location.length + 4;

  return (
    <div className={`glass-card-strong rounded-2xl p-3.5 ${className}`}>
      <p className="mb-2.5 text-xs font-medium text-stone-600">你要回饋的是這套穿搭</p>
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-stone-200/80">
          <OutfitPhotoDisplay
            photoUrl={outfit.photoUrl}
            emoji="🧥"
            className="h-full w-full"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {detailParts.length > 0 ? (
            <p className="text-sm font-semibold leading-snug text-stone-800">
              {detailParts.join(" · ")}
            </p>
          ) : (
            <p className="text-sm font-semibold text-stone-800">今日拍攝的穿搭</p>
          )}
          {showFullAddress && (
            <p className="flex items-start gap-1 text-xs text-stone-600">
              <MapPin size={12} className="mt-0.5 shrink-0 text-stone-500" />
              <span className="line-clamp-2">{outfit.locationName}</span>
            </p>
          )}
          <p className="text-[11px] text-stone-500">
            調整下方滑桿，描述穿著這套衣服時的體感
          </p>
        </div>
      </div>
    </div>
  );
}
