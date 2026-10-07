import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDownIcon } from "lucide-react";
import type { GameView } from "./board";

export type GameSort = "time" | "spreadClosest" | "spreadLargest";

const SORTS: { id: GameSort; label: string; short: string }[] = [
  { id: "time", label: "Kickoff time", short: "Time" },
  { id: "spreadClosest", label: "Spread: closest games first", short: "Closest spread" },
  { id: "spreadLargest", label: "Spread: biggest favorites first", short: "Largest spread" },
];

export function isGameSort(value: unknown): value is GameSort {
  return SORTS.some((s) => s.id === value);
}

const kickoff = (game: GameView) => new Date(game.game.start_date).getTime();

/**
 * Sorts games by kickoff, or by the size of the spread. Games without a line sort last, and
 * ties fall back to kickoff time.
 */
export function sortGames(games: readonly GameView[], sort: GameSort): GameView[] {
  const byKickoff = (a: GameView, b: GameView) => kickoff(a) - kickoff(b) || a.game.id - b.game.id;
  if (sort === "time") return [...games].sort(byKickoff);

  const direction = sort === "spreadClosest" ? 1 : -1;
  return [...games].sort((a, b) => {
    const spreadA = a.game.home_spread;
    const spreadB = b.game.home_spread;
    if (spreadA === null || spreadB === null) {
      if (spreadA !== spreadB) return spreadA === null ? 1 : -1;
      return byKickoff(a, b);
    }
    return direction * (Math.abs(spreadA) - Math.abs(spreadB)) || byKickoff(a, b);
  });
}

export function GameSortMenu({
  sort,
  onChange,
}: {
  sort: GameSort;
  onChange: (sort: GameSort) => void;
}) {
  const current = SORTS.find((s) => s.id === sort) ?? SORTS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <ArrowUpDownIcon data-icon="inline-start" />
        <span className="sr-only">Sort by </span>
        {current.short}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort games by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(value) => {
              if (isGameSort(value)) onChange(value);
            }}
          >
            {SORTS.map((s) => (
              <DropdownMenuRadioItem key={s.id} value={s.id}>
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
