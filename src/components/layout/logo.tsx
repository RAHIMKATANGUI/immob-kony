import { cn } from "@/lib/utils";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#0b1222" />
        <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="#2dd4bf" strokeOpacity=".35" />
        <path d="M14 32 32 17l18 15v15a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="none" stroke="#2dd4bf" strokeWidth="4" strokeLinejoin="round" />
        <path d="M27 50V38h10v12" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className="font-display text-[15px] font-bold tracking-[0.14em]">
          IMMOB <span className="text-turquoise-400">KONY</span>
        </span>
      )}
    </div>
  );
}
