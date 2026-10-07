import { cn } from "@/lib/utils";
import { isFinal, type WeekView } from "./board";

/** Season pick record across every week */
export function sheetStats(weeks: WeekView[]) {
  const picks = weeks.flatMap((w) => w.picks);
  const wins = picks.filter((p) => p.result === "win").length;
  const losses = picks.filter((p) => p.result === "loss").length;
  const pending = picks.filter((p) => !isFinal(p.game.game)).length;
  const decided = wins + losses;
  const points = weeks.reduce((sum, w) => sum + w.points, 0);
  return { points, wins, losses, pending, winRate: decided === 0 ? null : wins / decided };
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg leading-none font-semibold tabular-nums", className)}>{value}</dd>
    </div>
  );
}

export function SheetStats({ weeks }: { weeks: WeekView[] }) {
  const { points, wins, losses, pending, winRate } = sheetStats(weeks);

  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Season record">
      <Stat label="Points" value={`${points}`} />
      <Stat label="Won" value={`${wins}`} className={wins > 0 ? "text-success" : undefined} />
      <Stat
        label="Lost"
        value={`${losses}`}
        className={losses > 0 ? "text-destructive" : undefined}
      />
      <Stat label="Pending" value={`${pending}`} />
      <Stat label="Win rate" value={winRate === null ? "–" : `${Math.round(winRate * 100)}%`} />
    </dl>
  );
}
