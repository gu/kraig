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

export interface Standing {
  /** 1-based, shared by tied sheets */
  rank: number;
  tied: boolean;
  of: number;
}

/**
 * Where `sheetId` ranks by points among `sheets` (standard competition ranking: two sheets tied
 * for 2nd are both 2nd, and the next is 4th). Null until any pick in the pool has been decided
 */
export function standing(
  sheets: readonly { sheetId: number; points: number; decided: number }[],
  sheetId: number,
): Standing | null {
  const own = sheets.find((s) => s.sheetId === sheetId);
  if (!own || sheets.every((s) => s.decided === 0)) return null;
  return {
    rank: 1 + sheets.filter((s) => s.points > own.points).length,
    tied: sheets.some((s) => s.sheetId !== sheetId && s.points === own.points),
    of: sheets.length,
  };
}

/** e.g. "1st of 5" or "T-2nd of 5" */
export function formatStanding({ rank, tied, of }: Standing) {
  return `${tied ? "T-" : ""}${ordinal(rank)} of ${of}`;
}

/** e.g. 1st, 2nd, 11th, 23rd */
export function ordinal(n: number) {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
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
