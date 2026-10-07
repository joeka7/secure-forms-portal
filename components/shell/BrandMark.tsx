import { FileLock2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Neutral product mark: an icon tile and the product name. */
export function BrandMark({ inverted, compact }: { inverted?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-lg",
          compact ? "h-8 w-8" : "h-9 w-9",
          inverted ? "bg-white/10 text-white ring-1 ring-inset ring-white/15" : "bg-primary text-white"
        )}
      >
        <FileLock2 className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} aria-hidden="true" strokeWidth={1.9} />
      </span>
      <span className={cn("leading-tight", inverted ? "text-white" : "text-primary")}>
        <span className={cn("block font-semibold tracking-tight", compact ? "text-[15px]" : "text-base")}>Secure Forms</span>
        {!compact && <span className={cn("block text-[11px] font-semibold uppercase tracking-[0.14em]", inverted ? "text-white/60" : "text-muted")}>Portal</span>}
      </span>
    </span>
  );
}
