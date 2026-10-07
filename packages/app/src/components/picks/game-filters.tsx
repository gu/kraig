import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListFilterIcon, XIcon } from "lucide-react";
import type { GameView } from "./board";
import { isGamePickable } from "./game-card";

export type GameFilter = "pickable" | "ranked";

const FILTERS: { id: GameFilter; label: string; description: string }[] = [
  {
    id: "pickable",
    label: "Has a team to pick",
    description: "Hides games that started or whose teams are used",
  },
  {
    id: "ranked",
    label: "Has a ranked team",
    description: "At least one AP Top 25 team",
  },
];

export function isGameRanked(game: GameView) {
  return game.home.rank !== null || game.away.rank !== null;
}

const PREDICATES: Record<GameFilter, (game: GameView) => boolean> = {
  pickable: isGamePickable,
  ranked: isGameRanked,
};

/** A game is shown when it matches every active filter */
export function matchesGameFilters(game: GameView, filters: readonly GameFilter[]) {
  return filters.every((filter) => PREDICATES[filter](game));
}

export function GameFiltersMenu({
  filters,
  onChange,
}: {
  filters: readonly GameFilter[];
  onChange: (filters: GameFilter[]) => void;
}) {
  const toggle = (filter: GameFilter, checked: boolean) =>
    onChange(
      checked
        ? [...filters.filter((f) => f !== filter), filter]
        : filters.filter((f) => f !== filter),
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <ListFilterIcon data-icon="inline-start" />
        Filters
        {filters.length > 0 && (
          <Badge className="ml-0.5 h-5 min-w-5 px-1.5 tabular-nums">
            {filters.length}
            <span className="sr-only"> active</span>
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Only show games that…</DropdownMenuLabel>
          {FILTERS.map((filter) => (
            <DropdownMenuCheckboxItem
              key={filter.id}
              checked={filters.includes(filter.id)}
              onCheckedChange={(checked) => toggle(filter.id, checked)}
              className="items-start"
            >
              <span className="flex flex-col gap-0.5">
                <span>{filter.label}</span>
                <span className="text-xs text-muted-foreground">{filter.description}</span>
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={filters.length === 0} onClick={() => onChange([])}>
          <XIcon />
          Clear filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Removable chips for the active filters, with how many games they leave */
export function ActiveGameFilters({
  filters,
  onChange,
  shown,
  total,
}: {
  filters: readonly GameFilter[];
  onChange: (filters: GameFilter[]) => void;
  shown: number;
  total: number;
}) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span aria-live="polite">
        Showing {shown} of {total} games
      </span>
      {FILTERS.filter((f) => filters.includes(f.id)).map((filter) => (
        <Badge key={filter.id} variant="secondary" className="h-7 gap-1 pr-1 pl-2.5">
          {filter.label}
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-5 rounded-full"
            aria-label={`Remove filter: ${filter.label}`}
            onClick={() => onChange(filters.filter((f) => f !== filter.id))}
          >
            <XIcon />
          </Button>
        </Badge>
      ))}
      <Button variant="link" size="sm" className="h-7 px-1" onClick={() => onChange([])}>
        Clear all
      </Button>
    </div>
  );
}
