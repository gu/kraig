import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PICKS_PER_WEEK } from "#/lib/picks";
import { ArrowLeftRightIcon, CheckIcon, LockIcon } from "lucide-react";
import { format } from "date-fns";
import { formatSpread, type GameView, type TeamView } from "./board";
import { TeamLogo } from "./team-logo";

const PICKABLE_STATES = ["open", "swap", "picked"];

function teamNote(team: TeamView, game: GameView) {
  const spread = formatSpread(team.spread);
  switch (team.state) {
    case "open":
    case "closed":
      return spread ? `Spread ${spread}` : "No line yet";
    case "swap":
      return `Switch pick to ${team.name}`;
    case "picked":
      return spread ? `Your pick · ${spread}` : "Your pick";
    case "lockedPick":
      return game.started ? "Locked pick" : "Your pick";
    case "used":
      return `Picked in week ${team.usedWeek}`;
    case "started":
      return "Game started";
    case "full":
      return `${PICKS_PER_WEEK} of ${PICKS_PER_WEEK} picks made`;
    case "unavailable":
      return "Not in this pool";
  }
}

function TeamPickButton({
  team,
  game,
  busy,
  onPick,
}: {
  team: TeamView;
  game: GameView;
  busy: boolean;
  onPick: (team: TeamView) => void;
}) {
  const pickable = PICKABLE_STATES.includes(team.state);
  const muted = team.state === "used" || team.state === "started" || team.state === "unavailable";

  return (
    <button
      type="button"
      aria-pressed={team.state === "picked" || team.state === "lockedPick"}
      disabled={!pickable || busy}
      onClick={() => onPick(team)}
      className={cn(
        "flex min-h-14 min-w-0 flex-1 basis-40 items-center gap-2.5 rounded-lg border bg-card py-2 pr-3 pl-2 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed",
        pickable && "hover:bg-muted",
        team.state === "picked" &&
          "border-primary bg-primary/10 ring-1 ring-primary hover:bg-primary/15",
        team.state === "lockedPick" && "border-primary/40 bg-primary/10",
        muted && "bg-muted text-muted-foreground",
        team.state === "full" && "border-dashed text-muted-foreground",
      )}
    >
      <TeamLogo team={team.team} name={team.name} muted={muted} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold">{team.name}</span>
        <span
          className={cn(
            "truncate text-xs text-muted-foreground",
            (team.state === "picked" || team.state === "lockedPick") && "font-medium text-primary",
          )}
        >
          {teamNote(team, game)}
        </span>
      </span>
      {team.state === "picked" && <CheckIcon className="size-5 text-primary" aria-hidden="true" />}
      {team.state === "swap" && (
        <ArrowLeftRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
      {((team.state === "lockedPick" && game.started) || team.state === "started") && (
        <LockIcon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

export function GameCard({
  game,
  busy,
  onPick,
}: {
  game: GameView;
  busy: boolean;
  onPick: (game: GameView, team: TeamView) => void;
}) {
  const overUnder = game.game.over_under;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex w-28 shrink-0 flex-col items-start gap-1">
        {game.started ? (
          <Badge variant="secondary">Started</Badge>
        ) : (
          <span className="text-sm font-semibold">
            {format(new Date(game.game.start_date), "h:mm a")}
          </span>
        )}
        {overUnder !== null && (
          <span className="text-xs text-muted-foreground">O/U {overUnder}</span>
        )}
      </div>
      <div
        role="group"
        aria-label={`${game.away.name} at ${game.home.name}`}
        className="flex min-w-0 flex-1 basis-96 flex-wrap items-center gap-2"
      >
        <TeamPickButton
          team={game.away}
          game={game}
          busy={busy}
          onPick={(team) => onPick(game, team)}
        />
        <span className="text-xs text-muted-foreground">at</span>
        <TeamPickButton
          team={game.home}
          game={game}
          busy={busy}
          onPick={(team) => onPick(game, team)}
        />
      </div>
    </div>
  );
}

export function isGamePickable(game: GameView) {
  return [game.away, game.home].some(
    (t) => PICKABLE_STATES.includes(t.state) || t.state === "lockedPick",
  );
}
