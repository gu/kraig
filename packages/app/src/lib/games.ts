import db from "@db/client";

// Sportsbooks to take the spread from, in order of preference
const PREFERRED_PROVIDERS = ["DraftKings", "ESPN Bet", "Bovada"];

/** Every game in kickoff order, with its spread from the preferred sportsbook. Server only */
export async function loadGamesWithLines() {
  const [games, lines] = await Promise.all([
    db
      .selectFrom("ext_game")
      .select([
        "id",
        "week",
        "start_date",
        "home_id",
        "home_team",
        "away_id",
        "away_team",
        "completed",
        "home_points",
        "away_points",
      ])
      .orderBy("start_date")
      .orderBy("id")
      .execute(),
    db.selectFrom("ext_line").select(["game_id", "provider", "spread", "over_under"]).execute(),
  ]);

  const linesByGame = new Map<number, typeof lines>();
  for (const line of lines) {
    linesByGame.set(line.game_id, [...(linesByGame.get(line.game_id) ?? []), line]);
  }
  const rank = (provider: string) => {
    const index = PREFERRED_PROVIDERS.indexOf(provider);
    return index === -1 ? PREFERRED_PROVIDERS.length : index;
  };

  return games.map((game) => {
    const line = (linesByGame.get(game.id) ?? [])
      .filter((l) => l.spread !== null)
      .sort((a, b) => rank(a.provider) - rank(b.provider))[0];

    return {
      ...game,
      start_date: game.start_date.toISOString(),
      // CFBD spreads are relative to the home team
      home_spread: line?.spread ?? null,
      over_under: line?.over_under ?? null,
    };
  });
}
