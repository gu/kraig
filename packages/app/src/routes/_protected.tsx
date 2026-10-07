import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getSession } from "@/lib/auth.functions";
import { CurrentUserProvider } from "#/components/current-user";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "#/components/ui/sidebar";
import { AppSidebar } from "#/components/app-sidebar";
import { HeaderBreadcrumbs } from "#/components/header-breadcrumbs";
import { Separator } from "#/components/ui/separator";

export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    return { user: session.user };
  },
  component: ProtectedRouteRoot,
});

function ProtectedRouteRoot() {
  const { user } = Route.useRouteContext();

  return (
    <CurrentUserProvider user={user}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-center"
            />
            <HeaderBreadcrumbs />
          </header>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </CurrentUserProvider>
  );
}
