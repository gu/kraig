import type { ScopedRow } from "#/lib/leaderboard";
import { ordinal } from "#/lib/scoring";

/** Highlight for one of the viewer's sheets */
export function MySheetTile({
  row,
  total,
  leader,
}: {
  row: ScopedRow;
  total: number;
  leader: number;
}) {
  const behind = leader - row.shown;
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5">
      <div className="flex h-13 min-w-13 flex-col items-center justify-center rounded-lg bg-primary px-1.5 text-primary-foreground">
        <span className="text-lg leading-none font-bold tabular-nums">
          {row.scopedRank.tied ? "T-" : ""}
          {ordinal(row.scopedRank.rank)}
        </span>
        <span className="text-[11px] opacity-85">of {total}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold">{row.name}</span>
        <span className="text-sm text-muted-foreground">
          {behind === 0
            ? "Leading the pool"
            : `${behind} ${behind === 1 ? "pt" : "pts"} behind 1st`}
        </span>
      </div>
      <div className="text-right">
        <div className="text-xl font-bold tabular-nums">{row.shown}</div>
        <div className="text-xs text-muted-foreground">pts</div>
      </div>
    </div>
  );
}
