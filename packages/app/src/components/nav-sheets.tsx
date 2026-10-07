import { useCurrentPoolDisplayId } from "#/hooks/use-current-pool-display-id";
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
  const poolDisplayId = useCurrentPoolDisplayId();
  const { data: userSheets } = useSheets({ poolDisplayId });

  if (!poolDisplayId) {
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
                  to: "/pool/$poolDisplayId/sheet/$sheetDisplayId",
                  params: { poolDisplayId, sheetDisplayId: sheet.display_id },
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
