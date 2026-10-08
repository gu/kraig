import { Badge } from "@/components/ui/badge";
import { winRate, type ScopedRow } from "#/lib/leaderboard";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { RankBadge } from "./rank-badge";

function Movement({ by }: { by: number | null }) {
  if (by === null || by === 0) return null;
  const up = by > 0;
  const Icon = up ? ChevronUpIcon : ChevronDownIcon;
  return (
    <span
      className={cn(
        "flex items-center text-xs font-semibold tabular-nums",
        up ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-3.5" strokeWidth={3} aria-hidden="true" />
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {Math.abs(by)}
    </span>
  );
}

export function LeaderboardTable({
  rows,
  throughWeek,
}: {
  rows: readonly ScopedRow[];
  throughWeek: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-160 border-collapse text-sm">
        <caption className="sr-only">Standings</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="w-24 px-4 py-3 font-medium">
              Rank
            </th>
            <th scope="col" className="px-2 py-3 font-medium">
              Sheet
            </th>
            <th scope="col" className="px-2 py-3 text-right font-medium">
              Points
            </th>
            <th scope="col" className="px-2 py-3 text-right font-medium">
              Week {throughWeek}
            </th>
            <th scope="col" className="px-2 py-3 text-right font-medium">
              Record
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Win rate
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rate = winRate(row);
            return (
              <tr
                key={row.id}
                className={cn("border-b last:border-b-0", row.mine && "bg-primary/5")}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <RankBadge rank={row.scopedRank} />
                    <Movement by={row.movement} />
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{row.name}</span>
                    {row.mine && <Badge>You</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{row.owner}</div>
                </td>
                <td className="px-2 py-3 text-right text-base font-bold tabular-nums">
                  {row.shown}
                </td>
                <td className="px-2 py-3 text-right text-muted-foreground tabular-nums">
                  +{row.weekPoints}
                </td>
                <td className="px-2 py-3 text-right text-muted-foreground tabular-nums">
                  {row.wins}–{row.losses}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                  {rate === null ? "–" : `${Math.round(rate * 100)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
