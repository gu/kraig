import { getYear } from "date-fns";
import { cfbdClient } from "./client";
import z from "zod";

const ConferenceResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string().nullish(),
  classification: z.string(),
  memberCount: z.number(),
});

const ConferenceSchema = ConferenceResponseSchema.extend({
  abbreviation: z.string(),
});

type Conference = z.infer<typeof ConferenceSchema>;

export const AllowedConferenceAbbreviations: readonly string[] = [
  "ACC",
  "B12",
  "B1G",
  "PAC",
  "SEC",
  "Ind",
];

export async function getConferences() {
  const rawResponse = await cfbdClient
    .get("https://api.collegefootballdata.com/conferences", {
      searchParams: {
        year: getYear(new Date()),
      },
    })
    .json();

  const response = z.array(ConferenceResponseSchema).parse(rawResponse);

  const validConferences: Conference[] = [];

  for (const conference of response) {
    const abbr = conference.abbreviation;

    if (abbr && AllowedConferenceAbbreviations.includes(abbr)) {
      validConferences.push({
        ...conference,
        abbreviation: abbr,
      });
    }
  }

  return validConferences;
}
