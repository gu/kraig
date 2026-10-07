import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { usePools } from "#/hooks/use-pools";
import { useSheets } from "#/hooks/use-sheets";
import { Link, useParams } from "@tanstack/react-router";

export function HeaderBreadcrumbs() {
  const { poolDisplayId, sheetDisplayId } = useParams({ strict: false });
  const { data: userPools } = usePools();
  const { data: sheets } = useSheets({ poolDisplayId });

  const pool = userPools?.find((p) => p.display_id === poolDisplayId);
  const sheet = sheets?.find((s) => s.display_id === sheetDisplayId);

  if (!poolDisplayId || !pool) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {sheet ? (
            <BreadcrumbLink render={<Link to="/pool/$poolDisplayId" params={{ poolDisplayId }} />}>
              {pool.name}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{pool.name}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {sheet && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{sheet.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
