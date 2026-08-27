import { useCurrentPoolId } from "#/hooks/use-current-pool-id";
import { useSheets } from "#/hooks/use-sheets";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useNavigate } from "@tanstack/react-router";
import { FileSpreadsheet } from "lucide-react";

export function NavSheets() {
  const navigate = useNavigate();
  const { currentPoolId } = useCurrentPoolId();
  const { data: userSheets } = useSheets({ poolId: currentPoolId?.id });

  if (!currentPoolId) {
    return;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Your Sheets</SidebarGroupLabel>
      <SidebarMenu>
        {(userSheets ?? []).map((sheet) => (
          <SidebarMenuItem key={sheet.id}>
            <SidebarMenuButton
              onClick={() =>
                navigate({
                  to: "/sheet/$sheetDisplayId",
                  params: { sheetDisplayId: sheet.display_id },
                })
              }
            >
              <FileSpreadsheet />
              {sheet.name}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
