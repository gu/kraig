import { LeaderboardTable } from "#/components/leaderboard/leaderboard-table";
import { MySheetTile } from "#/components/leaderboard/my-sheet-tile";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#/components/ui/empty";
import { Skeleton } from "#/components/ui/skeleton";
import { useLeaderboard } from "#/hooks/use-leaderboard";
import { scopeLeaderboard, type LeaderboardScope } from "#/lib/leaderboard";
import { describeScoring } from "#/lib/scoring";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_protected/pool/$poolDisplayId/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { poolDisplayId } = Route.useParams();
  const { data: leaderboard, isPending } = useLeaderboard(poolDisplayId);
  const [scope, setScope] = useState<LeaderboardScope>("season");

  const rows = useMemo(
    () => (leaderboard ? scopeLeaderboard(leaderboard.rows, scope) : []),
    [leaderboard, scope],
  );
  const throughWeek = leaderboard?.throughWeek ?? null;
  const leader = Math.max(0, ...rows.map((r) => r.shown));
  const sheetCount = `${rows.length} ${rows.length === 1 ? "sheet" : "sheets"}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          {leaderboard && (
            <p className="text-sm text-muted-foreground">
              {throughWeek === null ? sheetCount : `${sheetCount} · Through week ${throughWeek}`}
            </p>
          )}
        </div>
        {throughWeek !== null && (
          <div role="group" aria-label="Show points for" className="flex rounded-lg bg-muted p-0.5">
            {(
              [
                ["season", "Season"],
                ["week", `Week ${throughWeek}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={scope === id}
                onClick={() => setScope(id)}
                className={cn(
                  "h-9 rounded-md px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  scope === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {leaderboard && throughWeek === null && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>No standings yet</EmptyTitle>
            <EmptyDescription>
              Standings start once the first picks in this pool are final. {sheetCount}{" "}
              {rows.length === 1 ? "is" : "are"} entered.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {leaderboard && throughWeek !== null && (
        <>
          {rows.some((r) => r.mine) && (
            <section
              aria-label="Your sheets"
              className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3"
            >
              {rows
                .filter((r) => r.mine)
                .map((row) => (
                  <MySheetTile key={row.id} row={row} total={rows.length} leader={leader} />
                ))}
            </section>
          )}
          <LeaderboardTable rows={rows} throughWeek={throughWeek} />
          <p className="text-xs text-muted-foreground">
            Wins earn {describeScoring()}. Tied sheets share a rank.
          </p>
        </>
      )}
    </div>
  );
}
