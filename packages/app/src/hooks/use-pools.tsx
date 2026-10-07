import { toPoolSettings } from "#/lib/pool-settings";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

const getUserPools = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id;

    const pools = await db
      .selectFrom("pool")
      .select(["id", "display_id", "name", "created_at"])
      .where("owner_id", "=", userId)
      .execute();

    return pools;
  });

export function usePools() {
  return useQuery({
    queryKey: ["pools", "user"],
    queryFn: () => getUserPools(),
  });
}

const getPool = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ poolDisplayId: z.string() }))
  .handler(async ({ context, data }) => {
    const pool = await db
      .selectFrom("pool")
      .select([
        "id",
        "display_id",
        "name",
        "conferences",
        "max_sheets",
        "picks_per_week",
        "pick_type",
      ])
      .where("owner_id", "=", context.user.id)
      .where("display_id", "=", data.poolDisplayId)
      .executeTakeFirstOrThrow();

    return {
      id: pool.id,
      display_id: pool.display_id,
      name: pool.name,
      settings: toPoolSettings(pool),
    };
  });

export function usePool(poolDisplayId: string) {
  return useQuery({
    queryKey: ["pools", "detail", poolDisplayId],
    queryFn: () => getPool({ data: { poolDisplayId } }),
  });
}

const getConferences = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(() =>
    db.selectFrom("ext_conference").select(["name", "abbreviation"]).orderBy("name").execute(),
  );

/** Conferences a pool can be limited to */
export function useConferences() {
  return useQuery({
    queryKey: ["conferences"],
    queryFn: () => getConferences(),
    staleTime: Infinity,
  });
}
