"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BotIcon, ChevronsUpDownIcon } from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { useQuery } from "@tanstack/react-query";
import { useCurrentPoolDisplayId } from "#/hooks/use-current-pool-display-id";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { queryClient } from "#/lib/query-client";

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

export function PoolSwitcher() {
  const router = useRouter();
  const navigate = useNavigate();
  const currentPoolDisplayId = useCurrentPoolDisplayId();

  const { data: userPools } = useQuery({
    queryKey: ["pools", "user"],
    queryFn: () => getUserPools(),
  });

  const { isMobile } = useSidebar();

  if (!userPools || userPools.length === 0) {
    return null;
  }

  const activePool = userPools.find((p) => p.display_id === currentPoolDisplayId) ?? userPools[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {userPools && userPools.length > 0 && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <BotIcon />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{activePool.name}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-fit"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Pools
                  </DropdownMenuLabel>
                  {userPools.map((pool) => (
                    <DropdownMenuItem
                      key={pool.display_id}
                      onClick={() => {
                        navigate({
                          to: "/pool/$poolDisplayId",
                          params: { poolDisplayId: pool.display_id },
                        });
                        router.invalidate();
                        queryClient.invalidateQueries({ queryKey: ["pools"] });
                      }}
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-md border">
                        <BotIcon />
                      </div>
                      {pool.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
