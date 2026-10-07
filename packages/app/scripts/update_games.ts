import { createClients, syncApRankings, syncGames, syncLines } from "./lib/external.ts";

const { client, db } = createClients();

// #region Read the teams and conferences already in the db
const schools = (await db.selectFrom("ext_team").select("school").execute()).map((t) => t.school);
const conferenceAbbreviations = (
  await db.selectFrom("ext_conference").select("abbreviation").execute()
).map((c) => c.abbreviation);

if (schools.length === 0) {
  await db.destroy();
  throw new Error("No teams found in the database. Run `pnpm seed-external-data` first.");
}
console.log(`> Updating games for ${schools.length} teams`);
// #endregion

// #region Update game, betting line and AP ranking data in db
const gameIds = await syncGames({ client, db, schools });
await syncLines({ client, db, conferenceAbbreviations, gameIds });
await syncApRankings({ client, db });
// #endregion

// #region Cleanup
await db.destroy();
console.log();
console.log("> Completed");
// #endregion
