import { rankLabel, type Rank } from "#/lib/leaderboard";
import { cn } from "@/lib/utils";

/** A sheet's rank; the top 3 stand out */
export function RankBadge({ rank, className }: { rank: Rank; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums",
        rank.rank <= 3 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {rankLabel(rank)}
    </span>
  );
}
