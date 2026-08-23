import { useCurrentPoolId } from "#/hooks/use-current-pool-id";
import { authMiddleware } from "#/middleware/auth";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import db from "@db/client";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

const getPoolSheetsForUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ poolId: z.number() }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const poolId = data.poolId;

    const sheets = await db
      .selectFrom("sheet")
      .select(["id", "display_id", "name"])
      .where("owner_id", "=", userId)
      .where("pool_id", "=", poolId)
      .execute();

    return sheets;
  });

export function NavSheets() {
  const { currentPoolId } = useCurrentPoolId();

  if (!currentPoolId) {
    return;
  }

  const { data: userPools } = useQuery({
    queryKey: ["sheets", "user"],
    queryFn: () => getPoolSheetsForUser({ data: { poolId: currentPoolId?.id } }),
  });

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Your Sheets</SidebarGroupLabel>
      <SidebarMenu>
        {(userPools ?? []).map((pool) => (
          <SidebarMenuItem key={pool.id}>{pool.name}</SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
