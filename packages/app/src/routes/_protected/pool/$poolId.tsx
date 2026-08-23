import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/pool/$poolId")({ component: PoolDashboard });

function PoolDashboard() {
  const { poolId } = Route.useParams();

  return <span>hey {poolId}</span>;
}
