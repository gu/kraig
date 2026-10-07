import z from "zod";

export const PICK_TYPES = ["outright", "spread"] as const;
export type PickType = (typeof PICK_TYPES)[number];

/** Bounds for the per-pool counts, matching the pool table's check constraints */
export const SETTING_LIMITS = { min: 1, max: 10 } as const;

export const DEFAULT_MAX_SHEETS = 2;
export const DEFAULT_PICKS_PER_WEEK = 5;
export const DEFAULT_PICK_TYPE: PickType = "outright";

export interface PoolSettings {
  /** ext_conference names whose teams can be picked. Null means every conference */
  conferences: string[] | null;
  maxSheets: number;
  picksPerWeek: number;
  pickType: PickType;
}

export const DEFAULT_POOL_SETTINGS: PoolSettings = {
  conferences: null,
  maxSheets: DEFAULT_MAX_SHEETS,
  picksPerWeek: DEFAULT_PICKS_PER_WEEK,
  pickType: DEFAULT_PICK_TYPE,
};

const count = z.number().int().min(SETTING_LIMITS.min).max(SETTING_LIMITS.max);

export const poolSettingsSchema = z.object({
  conferences: z.array(z.string()).min(1).nullable(),
  maxSheets: count,
  picksPerWeek: count,
  pickType: z.enum(PICK_TYPES),
});

/** Settings from a pool row */
export function toPoolSettings(pool: {
  conferences: string[] | null;
  max_sheets: number;
  picks_per_week: number;
  pick_type: string;
}): PoolSettings {
  return {
    conferences: pool.conferences,
    maxSheets: pool.max_sheets,
    picksPerWeek: pool.picks_per_week,
    pickType: pool.pick_type === "spread" ? "spread" : "outright",
  };
}

export function isConferenceInPool(
  settings: Pick<PoolSettings, "conferences">,
  conference: string,
) {
  return settings.conferences === null || settings.conferences.includes(conference);
}

/** Conferences to store for a pool: null when none are excluded, meaning every conference */
export function selectedConferences(all: readonly string[], excluded: readonly string[]) {
  if (excluded.length === 0) return null;
  return all.filter((name) => !excluded.includes(name));
}

export const PICK_TYPE_LABELS: Record<PickType, { name: string; short: string; rule: string }> = {
  outright: {
    name: "Wins outright",
    short: "Winning outright",
    rule: "A pick wins if the team wins the game outright. Spreads are shown for reference only.",
  },
  spread: {
    name: "Covers the spread",
    short: "Covering the spread",
    rule: "A pick wins if the team covers the spread: its score plus the spread beats the opponent.",
  },
};
