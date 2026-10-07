import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PICKS_PER_WEEK } from "#/lib/picks";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { WeekView } from "./board";

export function WeekTabs({
  weeks,
  selectedWeek,
  onSelect,
}: {
  weeks: WeekView[];
  selectedWeek: number;
  onSelect: (week: number) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const index = weeks.findIndex((w) => w.week === selectedWeek);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedWeek]);

  return (
    <nav aria-label="Weeks" className="flex items-stretch gap-2">
      <Button
        variant="outline"
        className="h-auto w-10"
        aria-label="Previous week"
        disabled={index <= 0}
        onClick={() => onSelect(weeks[index - 1].week)}
      >
        <ChevronLeftIcon />
      </Button>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-0.5">
        {weeks.map((week) => {
          const selected = week.week === selectedWeek;
          return (
            <button
              key={week.week}
              ref={selected ? selectedRef : undefined}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onSelect(week.week)}
              className={cn(
                "flex min-w-36 shrink-0 flex-col gap-0.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                selected && "border-primary ring-1 ring-primary hover:bg-card",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">Week {week.week}</span>
                {week.state === "open" && <Badge>This week</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">{week.dates}</span>
              <span
                className={cn(
                  "text-xs font-medium",
                  week.state === "open" ? "text-primary" : "text-muted-foreground",
                )}
              >
                {week.state === "upcoming"
                  ? `Opens after week ${week.week - 1}`
                  : `${week.picks.length}/${PICKS_PER_WEEK} picked`}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        variant="outline"
        className="h-auto w-10"
        aria-label="Next week"
        disabled={index === -1 || index >= weeks.length - 1}
        onClick={() => onSelect(weeks[index + 1].week)}
      >
        <ChevronRightIcon />
      </Button>
    </nav>
  );
}
