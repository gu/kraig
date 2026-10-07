export type WeekState = "complete" | "open" | "upcoming";

/**
 * Picks can only be made for the open week: the earliest week that still has a game that hasn't
 * kicked off. Returns null once every game of the season has started.
 */
export function getOpenWeek(games: { week: number; start_date: string }[], now: Date) {
  let openWeek: number | null = null;
  for (const game of games) {
    if (new Date(game.start_date) > now && (openWeek === null || game.week < openWeek)) {
      openWeek = game.week;
    }
  }
  return openWeek;
}

export function getWeekState(week: number, openWeek: number | null): WeekState {
  if (openWeek === null || week < openWeek) return "complete";
  if (week === openWeek) return "open";
  return "upcoming";
}

export function hasStarted(game: { start_date: string }, now: Date) {
  return new Date(game.start_date) <= now;
}
