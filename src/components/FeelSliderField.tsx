import { motion } from "motion/react";
import type { ReactNode } from "react";
import { FeelRangeSlider } from "./FeelRangeSlider";

type FeelSliderFieldProps = {
  label: string;
  value: number;
  color: string;
  icon: ReactNode;
  onChange: (value: number) => void;
};

export function FeelSliderField({
  label,
  value,
  color,
  icon,
  onChange,
}: FeelSliderFieldProps) {
  return (
    <div className="mb-6 last:mb-0 group">
      <div className="mb-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-bold text-stone-700 transition-colors group-hover:text-stone-900">
          <div
            className="rounded-lg p-1.5 text-stone-400 transition-colors"
            style={{
              color: value > 10 ? color : undefined,
              backgroundColor: value > 10 ? `${color}18` : "rgba(255,255,255,0.6)",
            }}
          >
            {icon}
          </div>
          {label}
        </label>
        <motion.span
          key={value}
          initial={{ scale: 1.1, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-mono text-xs font-black tabular-nums"
          style={{ color: value > 10 ? color : "#a8a29e" }}
        >
          {value}%
        </motion.span>
      </div>
      <FeelRangeSlider
        value={value}
        color={color}
        onChange={onChange}
        aria-label={label}
      />
    </div>
  );
}
