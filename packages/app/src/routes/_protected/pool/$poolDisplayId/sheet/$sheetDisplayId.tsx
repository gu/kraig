import { EditSheetNameDialog } from "#/components/edit-sheet-name-dialog";
import { buildBoard, type GameView, type PickView, type TeamView } from "#/components/picks/board";
import { GameCard, gameCardId } from "#/components/picks/game-card";
import {
  ActiveGameFilters,
  GameFiltersMenu,
  matchesGameFilters,
  type GameFilter,
} from "#/components/picks/game-filters";
import { GameSortMenu, sortGames, type GameSort } from "#/components/picks/game-sort";
import { SheetStats } from "#/components/picks/sheet-stats";
import { UsedTeamsCard } from "#/components/picks/used-teams-card";
import { WeekPicksCard } from "#/components/picks/week-picks-card";
import { WeekPicksStrip } from "#/components/picks/week-picks-strip";
import { WeekTabs } from "#/components/picks/week-tabs";
import { Card, CardHeader, CardTitle } from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import { toast } from "#/components/ui/toast";
import { useNow } from "#/hooks/use-now";
import { useRemovePick, useSavePick, useSheetBoard } from "#/hooks/use-sheet-picks";
import { useSheets } from "#/hooks/use-sheets";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { LockIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [filters, setFilters] = useState<GameFilter[]>([]);
  const [sort, setSort] = useState<GameSort>("time");

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

  const shownGames = useMemo(() => {
    if (!selectedWeek) return [];
    const search = query.trim().toLowerCase();
    const matching = selectedWeek.games.filter(
      (game) =>
        (!search ||
          game.away.name.toLowerCase().includes(search) ||
          game.home.name.toLowerCase().includes(search)) &&
        matchesGameFilters(game, filters),
    );
    return sortGames(matching, sort);
  }, [selectedWeek, query, filters, sort]);

  // Kickoff order is grouped by day; other sorts are a single list
  const sections = useMemo(() => {
    if (sort !== "time") return shownGames.length > 0 ? [{ label: null, games: shownGames }] : [];
    const groups = new Map<string, GameView[]>();
    for (const game of shownGames) {
      const label = format(new Date(game.game.start_date), "EEEE, MMM d");
      groups.set(label, [...(groups.get(label) ?? []), game]);
    }
    return [...groups.entries()].map(([label, games]) => ({ label, games }));
  }, [shownGames, sort]);

  // Scroll to a game once it's rendered, after clearing anything that was hiding it
  const [scrollToGameId, setScrollToGameId] = useState<number | null>(null);
  useEffect(() => {
    if (scrollToGameId === null) return;
    const card = document.getElementById(gameCardId(scrollToGameId));
    if (!card) return;
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    card.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    setScrollToGameId(null);
  }, [scrollToGameId, sections]);

  const onShowGame = (pick: PickView) => {
    if (!shownGames.includes(pick.game)) {
      setQuery("");
      setFilters([]);
    }
    setScrollToGameId(pick.game.game.id);
  };

  return (
    <div className="@container/sheet flex flex-col gap-4 p-4">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-1">
            <CardTitle className="truncate text-lg">{sheet?.name}</CardTitle>
            {sheet && (
              <EditSheetNameDialog sheetDisplayId={sheetDisplayId} currentName={sheet.name} />
            )}
          </div>
          {weeks.length > 0 && <SheetStats weeks={weeks} />}
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

          <WeekPicksStrip
            week={selectedWeek}
            busy={busy}
            onRemove={onRemove}
            onShowGame={onShowGame}
            className="@4xl/sheet:hidden"
          />

          <div className="flex flex-col gap-4 @4xl/sheet:flex-row @4xl/sheet:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
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
                <div className="flex items-center gap-2">
                  <GameSortMenu sort={sort} onChange={setSort} />
                  <GameFiltersMenu filters={filters} onChange={setFilters} />
                </div>
              </div>

              <ActiveGameFilters
                filters={filters}
                onChange={setFilters}
                shown={shownGames.length}
                total={selectedWeek.games.length}
              />

              {sections.map(({ label, games }) => (
                <section key={label ?? "all"} className="flex flex-col gap-2">
                  {label && (
                    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {label}
                    </h2>
                  )}
                  {games.map((game) => (
                    <GameCard
                      key={game.game.id}
                      game={game}
                      busy={busy}
                      onPick={onPick}
                      showDate={label === null}
                    />
                  ))}
                </section>
              ))}

              {sections.length === 0 && (
                <Empty className="border border-dashed">
                  <EmptyHeader>
                    <EmptyDescription>No games match your filters this week.</EmptyDescription>
                  </EmptyHeader>
                  {filters.length > 0 && (
                    <EmptyContent>
                      <Button variant="outline" size="sm" onClick={() => setFilters([])}>
                        Clear filters
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )}
            </div>

            <aside className="flex min-w-0 flex-col gap-4 @4xl/sheet:w-80 @4xl/sheet:shrink-0">
              <div className="hidden @4xl/sheet:block">
                <WeekPicksCard week={selectedWeek} busy={busy} onRemove={onRemove} />
              </div>
              <UsedTeamsCard weeks={weeks} selectedWeek={selectedWeek.week} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
