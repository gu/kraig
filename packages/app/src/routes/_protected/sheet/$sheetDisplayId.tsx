import { useCurrentPoolId } from "#/hooks/use-current-pool-id";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/sheet/$sheetDisplayId")({
  component: Sheet,
});

function Sheet() {
  const { sheetDisplayId } = Route.useParams();
  const { currentPoolId } = useCurrentPoolId();

  return (
    <>
      <span>hey</span>
      {sheetDisplayId}
      {currentPoolId?.displayId}
      {currentPoolId?.id}
    </>
  );
}
