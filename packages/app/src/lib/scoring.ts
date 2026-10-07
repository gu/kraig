import type { PickResult } from "#/components/picks/board";

/** Points per winning pick, stepping up as the season goes on */
export const SCORING_TIERS = [
  { fromWeek: 1, points: 1 },
  { fromWeek: 5, points: 2 },
  { fromWeek: 9, points: 3 },
  { fromWeek: 13, points: 4 },
] as const;

/** Points a winning pick earns in `week` */
export function winValue(week: number) {
  let points: number = SCORING_TIERS[0].points;
  for (const tier of SCORING_TIERS) {
    if (week >= tier.fromWeek) points = tier.points;
  }
  return points;
}

/** Points a pick earned: its week's value for a win, 0 for a loss, push or tie. Null until final */
export function pickPoints(result: PickResult | null, week: number, final: boolean) {
  if (!final) return null;
  return result === "win" ? winValue(week) : 0;
}

/** e.g. "1 pt in weeks 1–4, 2 in weeks 5–8, 3 in weeks 9–12 and 4 from week 13 on" */
export function describeScoring() {
  const parts = SCORING_TIERS.map((tier, i) => {
    const next = SCORING_TIERS[i + 1];
    const value = i === 0 ? `${tier.points} pt${tier.points === 1 ? "" : "s"}` : `${tier.points}`;
    return next
      ? `${value} in weeks ${tier.fromWeek}–${next.fromWeek - 1}`
      : `${value} from week ${tier.fromWeek} on`;
  });
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
