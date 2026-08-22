import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getSession } from "@/lib/auth.functions";
import { CurrentUserProvider } from "#/components/current-user";

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
      <Outlet />
    </CurrentUserProvider>
  );
}
