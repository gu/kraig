import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/pool/$poolDisplayId/sheet/$sheetDisplayId")({
  component: Sheet,
});

function Sheet() {
  const { poolDisplayId, sheetDisplayId } = Route.useParams();

  return (
    <>
      <span>hey</span>
      {sheetDisplayId}
      {poolDisplayId}
    </>
  );
}
