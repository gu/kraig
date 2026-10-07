import { EditSheetNameDialog } from "#/components/edit-sheet-name-dialog";
import { buildBoard, type GameView, type PickView, type TeamView } from "#/components/picks/board";
import { GameCard, isGamePickable } from "#/components/picks/game-card";
import { UsedTeamsCard } from "#/components/picks/used-teams-card";
import { WeekPicksCard } from "#/components/picks/week-picks-card";
import { WeekTabs } from "#/components/picks/week-tabs";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import { toast } from "#/components/ui/toast";
import { useNow } from "#/hooks/use-now";
import { useRemovePick, useSavePick, useSheetBoard } from "#/hooks/use-sheet-picks";
import { useSheets } from "#/hooks/use-sheets";
import { PICKS_PER_WEEK } from "#/lib/picks";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { LockIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import z from "zod";

export const Route = createFileRoute("/_protected/pool/$poolDisplayId/sheet/$sheetDisplayId")({
  validateSearch: z.object({ week: z.number().int().optional() }),
  component: Sheet,
});

function Sheet() {
  const { poolDisplayId, sheetDisplayId } = Route.useParams();
  const { week: weekParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const now = useNow();

  const { data: sheets } = useSheets({ poolDisplayId });
  const sheet = sheets?.find((s) => s.display_id === sheetDisplayId);

  const { data: boardData, isPending } = useSheetBoard(sheetDisplayId);
  const board = useMemo(() => (boardData ? buildBoard(boardData, now) : null), [boardData, now]);

  const savePick = useSavePick(sheetDisplayId);
  const removePick = useRemovePick(sheetDisplayId);
  const busy = savePick.isPending || removePick.isPending;

  const [query, setQuery] = useState("");
  const [hideUnavailable, setHideUnavailable] = useState(false);

  const weeks = board?.weeks ?? [];
  const selectedWeek =
    weeks.find((w) => w.week === weekParam) ??
    weeks.find((w) => w.week === board?.openWeek) ??
    weeks[weeks.length - 1];

  const selectWeek = (week: number) => {
    setQuery("");
    void navigate({ search: { week }, replace: true });
  };

  const onError = (error: Error) => {
    toast.add({ type: "error", title: "Couldn't update pick", description: error.message });
  };

  const onPick = (game: GameView, team: TeamView) => {
    if (team.state === "picked") {
      removePick.mutate(game.game.id, { onError });
    } else {
      savePick.mutate({ gameId: game.game.id, teamId: team.id }, { onError });
    }
  };

  const onRemove = (pick: PickView) => {
    removePick.mutate(pick.game.game.id, { onError });
  };

  const days = useMemo(() => {
    if (!selectedWeek) return [];
    const search = query.trim().toLowerCase();
    const groups = new Map<string, GameView[]>();
    for (const game of selectedWeek.games) {
      if (
        search &&
        !game.away.name.toLowerCase().includes(search) &&
        !game.home.name.toLowerCase().includes(search)
      ) {
        continue;
      }
      if (hideUnavailable && !isGamePickable(game)) continue;
      const label = format(new Date(game.game.start_date), "EEEE, MMM d");
      groups.set(label, [...(groups.get(label) ?? []), game]);
    }
    return [...groups.entries()];
  }, [selectedWeek, query, hideUnavailable]);

  const pickCount = selectedWeek?.picks.length ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{sheet?.name}</CardTitle>
          <CardDescription>
            {selectedWeek ? `Week ${selectedWeek.week} · ${selectedWeek.dates}` : " "}
          </CardDescription>
          <CardAction className="flex flex-wrap items-center gap-4">
            {selectedWeek && (
              <div className="flex flex-col gap-1.5">
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {pickCount} of {PICKS_PER_WEEK}
                  </span>{" "}
                  picks made
                </div>
                <div className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: PICKS_PER_WEEK }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 w-7 rounded-full",
                        i < pickCount ? "bg-primary" : "bg-muted",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            {sheet && (
              <EditSheetNameDialog sheetDisplayId={sheetDisplayId} currentName={sheet.name} />
            )}
          </CardAction>
        </CardHeader>
      </Card>

      {isPending && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-18 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {!isPending && !selectedWeek && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No games yet</EmptyTitle>
            <EmptyDescription>
              This season's schedule hasn't been loaded. Check back once games are available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {selectedWeek && (
        <>
          <WeekTabs weeks={weeks} selectedWeek={selectedWeek.week} onSelect={selectWeek} />

          <div className="flex flex-wrap items-start gap-4">
            <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
              {selectedWeek.state !== "open" && (
                <div className="flex items-center gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                  <LockIcon className="size-4 shrink-0" aria-hidden="true" />
                  {selectedWeek.state === "complete"
                    ? `Week ${selectedWeek.week} is over. These picks are final.`
                    : `Picks for week ${selectedWeek.week} open once every week ${selectedWeek.week - 1} game has kicked off.`}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative max-w-sm min-w-0 flex-1 basis-64">
                  <label htmlFor="team-search" className="sr-only">
                    Find a team
                  </label>
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="team-search"
                    type="search"
                    placeholder="Find a team"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hideUnavailable}
                    onChange={(event) => setHideUnavailable(event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Hide games with nothing to pick
                </label>
              </div>

              {days.map(([label, games]) => (
                <section key={label} className="flex flex-col gap-2">
                  <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {label}
                  </h2>
                  {games.map((game) => (
                    <GameCard key={game.game.id} game={game} busy={busy} onPick={onPick} />
                  ))}
                </section>
              ))}

              {days.length === 0 && (
                <Empty className="border border-dashed">
                  <EmptyHeader>
                    <EmptyDescription>No games match your filters this week.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </main>

            <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
              <WeekPicksCard week={selectedWeek} busy={busy} onRemove={onRemove} />
              <UsedTeamsCard weeks={weeks} selectedWeek={selectedWeek.week} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
