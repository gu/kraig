"use client";

import * as React from "react";

import { NavSheets } from "#/components/nav-sheets";
import { NavUser } from "@/components/nav-user";
import { PoolSwitcher } from "#/components/pool-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { CreatePoolDialog } from "./create-pool-dialog";
import { NavOverview } from "./nav-overview";
import { ClientOnly } from "@tanstack/react-router";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <ClientOnly>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <PoolSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <CreatePoolDialog />
          <NavOverview />
          <NavSheets />
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </ClientOnly>
  );
}
