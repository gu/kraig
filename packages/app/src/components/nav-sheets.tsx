import { useCurrentPoolId } from "#/hooks/use-current-pool-id";
import { useSheets } from "#/hooks/use-sheets";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSheets() {
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
          <SidebarMenuItem key={sheet.id}>{sheet.name}</SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
