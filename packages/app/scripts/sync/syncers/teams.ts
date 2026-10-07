import { z } from "zod";
import { requireRows, type Syncer } from "./index.ts";
import { syncTable } from "../sync-table.ts";

const TeamSchema = z.object({
  id: z.number(),
  school: z.string(),
  abbreviation: z.string().nullish(),
  conference: z.string().nullish(),
  logos: z.array(z.string()).nullish(),
});

export const teams: Syncer = {
  name: "teams",
  async run(ctx) {
    const conferences = requireRows(
      "ext_conference",
      await ctx.db.selectFrom("ext_conference").select("name").execute(),
    );
    const conferenceNames = new Set(conferences.map((c) => c.name));

    const response = await ctx.cfbd.get("teams", { year: ctx.year }, z.array(TeamSchema));
    const teamData = response.filter((t) => t.conference && conferenceNames.has(t.conference));

    return syncTable(ctx, {
      table: "ext_team",
      keys: ["id"],
      rows: teamData.map((t) => ({
        id: t.id,
        abbreviation: t.abbreviation,
        school: t.school,
        conference: t.conference!,
        logo_url: t.logos?.[0],
      })),
    });
  },
};
