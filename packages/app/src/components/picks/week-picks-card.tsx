import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { LockIcon, XIcon } from "lucide-react";
import { rankedName, type PickView, type WeekView } from "./board";
import { TeamLogo } from "./team-logo";
import { TeamName } from "./team-name";

/** Final score from the picked team's side, e.g. "W 31–17" */
function finalScore(pick: PickView) {
  const { home_points, away_points } = pick.game.game;
  if (pick.result === null || home_points === null || away_points === null) return null;
  const [ours, theirs] =
    pick.team === pick.game.home ? [home_points, away_points] : [away_points, home_points];
  return `${pick.result === "win" ? "W" : "L"} ${ours}–${theirs}`;
}

export function pickDetail(pick: PickView) {
  const opponent = pick.team === pick.game.home ? pick.game.away : pick.game.home;
  const prefix = pick.team === pick.game.home ? "vs" : "at";
  const when =
    finalScore(pick) ??
    (pick.game.started ? "Started" : format(new Date(pick.game.game.start_date), "EEE h:mm a"));
  return `${prefix} ${rankedName(opponent)} · ${when}`;
}

/** Pick slot colors: green for a win, red for a loss, otherwise primary (brighter while removable) */
export function pickTone(pick: Pick<PickView, "result">, removable: boolean) {
  if (pick.result === "win")
    return { border: "border-success", bg: "bg-success/10", ring: "ring-success" };
  if (pick.result === "loss") {
    return { border: "border-destructive", bg: "bg-destructive/10", ring: "ring-destructive" };
  }
  return removable
    ? { border: "border-primary", bg: "bg-primary/10", ring: "ring-primary" }
    : { border: "border-primary/40", bg: "bg-primary/5", ring: "ring-primary/40" };
}

export function WeekPicksCard({
  week,
  busy,
  onRemove,
}: {
  week: WeekView;
  busy: boolean;
  onRemove: (pick: PickView) => void;
}) {
  const emptySlots = Math.max(week.picksPerWeek - week.picks.length, 0);
  const emptyText =
    week.state === "open"
      ? "Pick a team"
      : week.state === "upcoming"
        ? `Opens after week ${week.week - 1}`
        : "No pick";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Week {week.week} picks</CardTitle>
        <CardAction className="text-sm text-muted-foreground">
          {week.picks.length} / {week.picksPerWeek}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ItemGroup className="gap-2">
          {week.picks.map((pick) => {
            const removable = week.state === "open" && !pick.game.started;
            const tone = pickTone(pick, removable);
            return (
              <Item
                key={pick.game.game.id}
                variant="outline"
                size="sm"
                className={cn(tone.border, tone.bg)}
              >
                <ItemMedia>
                  <TeamLogo team={pick.team.team} name={pick.team.name} className="size-8" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full">
                    <span className="min-w-0 truncate">
                      <TeamName team={pick.team} />
                    </span>
                  </ItemTitle>
                  <ItemDescription className="truncate">{pickDetail(pick)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {removable ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${pick.team.name}`}
                      disabled={busy}
                      onClick={() => onRemove(pick)}
                    >
                      <XIcon />
                    </Button>
                  ) : (
                    week.state === "open" && (
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <LockIcon className="size-3.5" aria-hidden="true" />
                        Locked
                      </span>
                    )
                  )}
                </ItemActions>
              </Item>
            );
          })}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div
              key={i}
              className="flex min-h-13 items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground"
            >
              <span className="flex size-8 items-center justify-center rounded-full border border-dashed text-xs font-semibold">
                {week.picks.length + i + 1}
              </span>
              {emptyText}
            </div>
          ))}
        </ItemGroup>
        <p className="text-xs text-muted-foreground">
          One team per game. Picks save as you make them and lock when their game kicks off; until
          then you can swap them.
        </p>
      </CardContent>
    </Card>
  );
}
