import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Leaderboard, LeaderboardRow } from "#/lib/leaderboard";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { RankBadge } from "./rank-badge";

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <li
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-lg px-2.5 py-1.5",
        row.mine && "bg-primary/5",
      )}
    >
      <RankBadge rank={row} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{row.name}</span>
        <span className="truncate text-xs text-muted-foreground">{row.owner}</span>
      </span>
      <span className="font-bold tabular-nums">{row.points}</span>
    </li>
  );
}

/** The top of the pool's standings, plus the viewer's sheets that fall outside it */
export function LeaderboardCard({
  leaderboard,
  poolDisplayId,
  topCount = 5,
}: {
  leaderboard: Leaderboard;
  poolDisplayId: string;
  topCount?: number;
}) {
  const { throughWeek, rows } = leaderboard;
  const top = rows.slice(0, topCount);
  const pinned = rows.slice(topCount).filter((r) => r.mine);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        {throughWeek !== null && (
          <CardAction className="text-sm text-muted-foreground">
            Through week {throughWeek}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-3">
        {throughWeek === null ? (
          <p className="rounded-lg bg-muted px-3 py-5 text-center text-sm text-muted-foreground">
            Standings start once the first picks are final.
          </p>
        ) : (
          <>
            <ol className="flex flex-col gap-0.5" aria-label="Top sheets">
              {top.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </ol>
            {pinned.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  Your other sheets
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
                <ol className="flex flex-col gap-0.5" aria-label="Your other sheets">
                  {pinned.map((row) => (
                    <Row key={row.id} row={row} />
                  ))}
                </ol>
              </>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Link
          to="/pool/$poolDisplayId/leaderboard"
          params={{ poolDisplayId }}
          className={buttonVariants({ variant: "secondary", className: "w-full" })}
        >
          View full leaderboard
        </Link>
      </CardFooter>
    </Card>
  );
}
