import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

const getPoolSheetsForUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ poolId: z.number().nullish(), poolDisplayId: z.string().nullish() }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const poolId = data.poolId;
    const poolDisplayId = data.poolDisplayId;

    if (
      (poolId === null || poolId === undefined) &&
      (poolDisplayId === null || poolDisplayId === undefined)
    ) {
      throw new Error("poolId or poolDisplayId not provided");
    }

    let poolQuery = db.selectFrom("pool").select(["id"]).where("owner_id", "=", userId);

    if (poolId !== null && poolId !== undefined) {
      poolQuery = poolQuery.where("id", "=", poolId);
    } else if (poolDisplayId !== null && poolDisplayId !== undefined) {
      poolQuery = poolQuery.where("display_id", "=", poolDisplayId);
    }

    const pool = await poolQuery.executeTakeFirstOrThrow();

    return await db
      .selectFrom("sheet")
      .select(["id", "display_id", "name"])
      .where("owner_id", "=", userId)
      .where("pool_id", "=", pool.id)
      .execute();
  });

export function useSheets({ poolId, poolDisplayId }: { poolId?: number; poolDisplayId?: string }) {
  return useQuery({
    queryKey: ["sheets", "user", poolId, poolDisplayId],
    queryFn: () => getPoolSheetsForUser({ data: { poolId, poolDisplayId } }),
    enabled:
      (poolId !== undefined && poolId !== null) ||
      (poolDisplayId !== undefined && poolDisplayId !== null),
  });
}
