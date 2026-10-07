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
import { PICKS_PER_WEEK } from "#/lib/picks";
import { format } from "date-fns";
import { LockIcon, XIcon } from "lucide-react";
import type { PickView, WeekView } from "./board";
import { TeamLogo } from "./team-logo";

function pickDetail(pick: PickView) {
  const opponent = pick.team === pick.game.home ? pick.game.away : pick.game.home;
  const prefix = pick.team === pick.game.home ? "vs" : "at";
  const when = pick.game.started
    ? "Started"
    : format(new Date(pick.game.game.start_date), "EEE h:mm a");
  return `${prefix} ${opponent.name} · ${when}`;
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
  const emptySlots = Math.max(PICKS_PER_WEEK - week.picks.length, 0);
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
          {week.picks.length} / {PICKS_PER_WEEK}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ItemGroup className="gap-2">
          {week.picks.map((pick) => {
            const removable = week.state === "open" && !pick.game.started;
            return (
              <Item
                key={pick.game.game.id}
                variant="outline"
                size="sm"
                className={
                  removable ? "border-primary bg-primary/10" : "border-primary/40 bg-primary/5"
                }
              >
                <ItemMedia>
                  <TeamLogo team={pick.team.team} name={pick.team.name} className="size-8" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="truncate">{pick.team.name}</ItemTitle>
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
