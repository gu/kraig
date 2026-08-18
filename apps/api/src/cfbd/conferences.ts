import { getYear } from "date-fns";
import { cfbdClient } from "./client";
import z from "zod";

const ConferenceSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string().nullish(),
  classification: z.string(),
  memberCount: z.number(),
});

type Conference = z.infer<typeof ConferenceSchema>;

const ConferenceListSchema = z.array(ConferenceSchema);

const AllowedConferenceAbbreviations = ["ACC", "B12", "B1G", "PAC", "SEC"];

export async function getConferences() {
  const rawResponse = await cfbdClient
    .get("https://api.collegefootballdata.com/conferences", {
      searchParams: {
        year: getYear(new Date()),
      },
    })
    .json();

  const response = ConferenceListSchema.parse(rawResponse);

  const validConferences: Conference[] = [];

  for (const conference of response) {
    if (
      conference.abbreviation &&
      AllowedConferenceAbbreviations.includes(conference.abbreviation)
    ) {
      validConferences.push(conference);
    }
  }

  return validConferences;
}
