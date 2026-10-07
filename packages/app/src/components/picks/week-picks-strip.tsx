import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PICKS_PER_WEEK } from "#/lib/picks";
import { cn } from "@/lib/utils";
import { CrosshairIcon, LockIcon, XIcon } from "lucide-react";
import { useRef } from "react";
import { rankedName, type PickView, type WeekView } from "./board";
import { TeamLogo } from "./team-logo";
import { pickDetail } from "./week-picks-card";

function summary(week: WeekView) {
  const made = week.picks.length;
  if (week.state === "upcoming") return <>Opens after week {week.week - 1}</>;
  if (week.state === "complete") {
    return (
      <>
        <strong className="font-semibold text-foreground">
          {made} of {PICKS_PER_WEEK}
        </strong>{" "}
        made
      </>
    );
  }
  const left = Math.max(PICKS_PER_WEEK - made, 0);
  return (
    <>
      <strong className="font-semibold text-foreground">
        {made} of {PICKS_PER_WEEK}
      </strong>{" "}
      made{left > 0 && ` · ${left} left`}
    </>
  );
}

function PickSlot({
  pick,
  removable,
  busy,
  onRemove,
  onShowGame,
}: {
  pick: PickView;
  removable: boolean;
  busy: boolean;
  onRemove: (pick: PickView) => void;
  onShowGame: (pick: PickView) => void;
}) {
  const detail = pickDetail(pick);
  // Showing the game moves focus there, so don't send it back to this slot (which would scroll
  // back up on browsers without `preventScroll`)
  const showingGame = useRef(false);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) showingGame.current = false;
      }}
    >
      <DropdownMenuTrigger
        aria-label={`${rankedName(pick.team)}, ${detail}`}
        className="flex min-h-19 w-full min-w-0 flex-col items-center gap-1.5 rounded-lg px-0.5 py-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
      >
        <span
          className={cn(
            "relative flex size-12 items-center justify-center rounded-full bg-primary/10 ring-2",
            removable ? "ring-primary" : "ring-primary/40",
          )}
        >
          <TeamLogo team={pick.team.team} name={pick.team.name} className="size-8" />
          {pick.team.rank !== null && (
            <span className="absolute -top-1.5 -right-2.5 rounded-full bg-foreground px-1.5 text-[10px] leading-4 font-semibold text-background tabular-nums">
              #{pick.team.rank}
            </span>
          )}
          {!removable && (
            <span className="absolute -right-1 -bottom-1 flex size-4.5 items-center justify-center rounded-full bg-background">
              <LockIcon className="size-3 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="w-full truncate text-center text-xs font-semibold">{pick.team.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" finalFocus={() => !showingGame.current}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{rankedName(pick.team)}</span>
            <span className="font-normal">{detail}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            showingGame.current = true;
            onShowGame(pick);
          }}
        >
          <CrosshairIcon />
          Show game
        </DropdownMenuItem>
        {removable ? (
          <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => onRemove(pick)}>
            <XIcon />
            Remove pick
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <LockIcon />
            {pick.game.started ? "Locked, game has started" : "Locked"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact row of the week's pick slots, for screens too narrow for the picks sidebar */
export function WeekPicksStrip({
  week,
  busy,
  onRemove,
  onShowGame,
  className,
}: {
  week: WeekView;
  busy: boolean;
  onRemove: (pick: PickView) => void;
  onShowGame: (pick: PickView) => void;
  className?: string;
}) {
  const emptySlots = Math.max(PICKS_PER_WEEK - week.picks.length, 0);
  const emptyLabel = week.state === "open" ? "Open" : "Empty";

  return (
    <section
      aria-labelledby="week-picks-strip-title"
      className={cn("flex flex-col gap-3 rounded-xl border bg-card p-3", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="week-picks-strip-title" className="text-sm font-semibold">
          Week {week.week} picks
        </h2>
        <span className="text-[13px] text-muted-foreground">{summary(week)}</span>
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {week.picks.map((pick) => (
          <li key={pick.game.game.id} className="min-w-0">
            <PickSlot
              pick={pick}
              removable={week.state === "open" && !pick.game.started}
              busy={busy}
              onRemove={onRemove}
              onShowGame={onShowGame}
            />
          </li>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <li
            key={`empty-${i}`}
            className="flex min-h-19 min-w-0 flex-col items-center gap-1.5 py-1 text-muted-foreground"
          >
            <span className="flex size-12 items-center justify-center rounded-full border-[1.5px] border-dashed text-[13px] font-semibold">
              {week.picks.length + i + 1}
            </span>
            <span className="text-xs">{emptyLabel}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
