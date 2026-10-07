import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

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
