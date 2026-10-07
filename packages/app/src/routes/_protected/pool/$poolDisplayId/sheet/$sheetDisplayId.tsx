import { EditSheetNameDialog } from "#/components/edit-sheet-name-dialog";
import { Card, CardAction, CardHeader, CardTitle } from "#/components/ui/card";
import { useSheets } from "#/hooks/use-sheets";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/pool/$poolDisplayId/sheet/$sheetDisplayId")({
  component: Sheet,
});

function Sheet() {
  const { poolDisplayId, sheetDisplayId } = Route.useParams();

  const { data: sheets } = useSheets({ poolDisplayId });
  const sheet = sheets?.find((s) => s.display_id === sheetDisplayId);

  return (
    <div className="p-4">
      <section className="py-2">
        <Card>
          <CardHeader>
            <CardTitle>{sheet?.name}</CardTitle>
            {sheet && (
              <CardAction>
                <EditSheetNameDialog sheetDisplayId={sheetDisplayId} currentName={sheet.name} />
              </CardAction>
            )}
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
