import { z } from "zod";
import type { Syncer } from "./index.ts";
import { syncTable } from "../sync-table.ts";

// Allowed conference abbreviations. Pulled directly from CFBD
const AllowedConferenceAbbreviations: readonly string[] = [
  "ACC",
  "B12",
  "B1G",
  "PAC",
  "SEC",
  "Ind",
];

const ConferenceResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string().nullish(),
  classification: z.string(),
  memberCount: z.number(),
});

export const conferences: Syncer = {
  name: "conferences",
  async run(ctx) {
    const response = await ctx.cfbd.get(
      "conferences",
      { year: ctx.year },
      z.array(ConferenceResponseSchema),
    );
    const conferenceData = response.filter(
      (c) => c.abbreviation && AllowedConferenceAbbreviations.includes(c.abbreviation),
    );

    return syncTable(ctx, {
      table: "ext_conference",
      keys: ["id"],
      rows: conferenceData.map((c) => ({
        id: c.id,
        abbreviation: c.abbreviation!,
        short_name: c.shortName,
        name: c.name,
      })),
    });
  },
};
