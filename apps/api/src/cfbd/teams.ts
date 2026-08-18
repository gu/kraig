import z from "zod";
import { cfbdClient } from "./client";
import { getYear } from "date-fns";
import { AllowedConferenceAbbreviations } from "./conferences";

const TeamSchema = z.object({
  id: z.number(),
  school: z.string(),
  abbreviation: z.string(),
  conference: z.string(),
});

const TeamListSchema = z.array(TeamSchema);

export async function getTeamsOfConference(conferenceAbbreviation: string) {
  if (!AllowedConferenceAbbreviations.includes(conferenceAbbreviation)) {
    throw new Error(`Unsupported conference ${conferenceAbbreviation}`);
  }

  const rawResponse = await cfbdClient
    .get("https://api.collegefootballdata.com/teams", {
      searchParams: {
        year: getYear(new Date()),
        conference: conferenceAbbreviation,
      },
    })
    .json();

  const response = TeamListSchema.parse(rawResponse);

  return response;
}
