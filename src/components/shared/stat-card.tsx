"use client";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, icon: Icon, hint, tone = "default", index = 0 }: {
  label: string; value: React.ReactNode; icon: LucideIcon; hint?: React.ReactNode; tone?: "default" | "brand" | "success" | "warning" | "danger"; index?: number;
}) {
  const tones = {
    default: "bg-secondary text-foreground",
    brand: "bg-brand/10 text-brand",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-soft sm:p-5"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-brand/0 blur-2xl transition-colors duration-500 group-hover:bg-brand/10" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-xl", tones[tone])}><Icon className="size-[18px]" /></span>
      </div>
      <p className="mt-3 font-display text-lg font-bold leading-tight tracking-tight tabular-nums sm:text-2xl xl:text-[26px]">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </motion.div>
  );
}
