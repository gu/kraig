"use client";

import * as React from "react";

import { NavSheets } from "#/components/nav-sheets";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { PoolSwitcher } from "#/components/pool-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { FrameIcon, PieChartIcon, MapIcon } from "lucide-react";
import { CreatePoolDialog } from "./create-pool-dialog";
import { NavOverview } from "./nav-overview";

// This is sample data.
const data = {
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: <FrameIcon />,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: <PieChartIcon />,
    },
    {
      name: "Travel",
      url: "#",
      icon: <MapIcon />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <PoolSwitcher />
        <CreatePoolDialog />
      </SidebarHeader>
      <SidebarContent>
        <NavOverview />
        <NavSheets />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
