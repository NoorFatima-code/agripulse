import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon: LucideIcon;
  variant?: "leaf" | "water" | "harvest" | "soil";
}

const variantBg: Record<NonNullable<StatCardProps["variant"]>, string> = {
  leaf: "bg-gradient-leaf",
  water: "bg-gradient-water",
  harvest: "bg-gradient-harvest",
  soil: "bg-[var(--soil)]",
};

export function StatCard({ label, value, unit, hint, icon: Icon, variant = "leaf" }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden border-border/60 shadow-soft transition-all hover:shadow-elevated hover:-translate-y-0.5">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-semibold text-foreground">{value}</span>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-soft",
              variantBg[variant],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
      <div className={cn("absolute inset-x-0 bottom-0 h-1", variantBg[variant])} />
    </Card>
  );
}
