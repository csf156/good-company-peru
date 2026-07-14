import { LEVEL_META, type Level } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface Props {
  level: Level;
  className?: string;
  size?: "sm" | "md";
}

export function LevelBadge({ level, className, size = "sm" }: Props) {
  const meta = LEVEL_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border font-mono uppercase tracking-tighter",
        size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]",
        className,
      )}
      style={{
        color: `hsl(${meta.color === "var(--primary)" ? "38 85% 55%" : ""})`,
        borderColor: `color-mix(in oklab, ${meta.color} 40%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${meta.color} 15%, transparent)`,
      }}
    >
      <span
        className="size-1 rounded-full"
        style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
      />
      <span style={{ color: meta.color }}>{meta.label}</span>
    </span>
  );
}
