import { useCurrentPoolId } from "#/hooks/use-current-pool-id";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useNavigate } from "@tanstack/react-router";
import { House, Podium } from "lucide-react";

export function NavOverview() {
  const navigate = useNavigate();
  const { currentPoolId } = useCurrentPoolId();

  if (!currentPoolId) {
    return;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Overview</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() =>
              navigate({
                to: "/pool/$poolDisplayId",
                params: { poolDisplayId: currentPoolId.displayId },
              })
            }
          >
            <House />
            <span>Dashboard</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <Podium />
            <span>Leaderboard</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
