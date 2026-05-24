import type { CSSProperties } from "react";
import { getColorChipTheme } from "../lib/color-lexicon";

export function OutfitColorChip({
  name,
  variant = "default",
}: {
  name: string;
  variant?: "default" | "on-photo";
}) {
  const theme = getColorChipTheme(name);

  return (
    <span
      className={`outfit-color-chip${variant === "on-photo" ? " outfit-color-chip--on-photo" : ""}`}
      style={
        {
          "--chip-fill": theme.fill,
          "--chip-bg": theme.bg,
          "--chip-border": theme.border,
          "--chip-text": theme.text,
        } as CSSProperties
      }
    >
      <span className="outfit-color-chip__swatch" aria-hidden />
      <span className="outfit-color-chip__label">{name}</span>
    </span>
  );
}
