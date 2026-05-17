import { motion } from "motion/react";
import { ChevronRight, Smile } from "lucide-react";

export function PendingFeedbackBanner({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onContinue}
      className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-[#378ADD]/25 bg-[#E6F1FB]/90 px-4 py-3 text-left shadow-sm transition-colors hover:bg-[#dceaf8] active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#378ADD]/15 text-[#378ADD]">
        <Smile size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-800">
          你有今日穿搭尚未填寫體感
        </span>
        <span className="mt-0.5 block text-xs text-stone-500">點此繼續填寫，完成你的數據貢獻</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-stone-400" />
    </motion.button>
  );
}
