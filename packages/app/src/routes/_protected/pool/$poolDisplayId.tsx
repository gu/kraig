import { Cta34 } from "#/components/cta34";
import { SheetRules } from "#/components/sheet-rules";
import { Button } from "#/components/ui/button";
import { toast } from "#/components/ui/toast";
import { useSheets } from "#/hooks/use-sheets";
import { queryClient } from "#/lib/query-client";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const Route = createFileRoute("/_protected/pool/$poolDisplayId")({
  component: PoolDashboard,
});

const createEmptySheet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ poolDisplayId: z.string() }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const pooldisplayId = data.poolDisplayId;

    const pool = await db
      .selectFrom("pool")
      .select(["id"])
      .where("owner_id", "=", userId)
      .where("display_id", "=", pooldisplayId)
      .executeTakeFirstOrThrow();

    return db
      .insertInto("sheet")
      .values({
        name: "New Sheet",
        owner_id: userId,
        pool_id: pool.id,
      })
      .returning(["id", "display_id", "name", "owner_id"])
      .executeTakeFirstOrThrow();
  });

function PoolDashboard() {
  const { poolDisplayId } = Route.useParams();
  const navigate = useNavigate();

  const { data: sheets } = useSheets({ poolDisplayId });

  const createHandler = async () => {
    const newSheet = await createEmptySheet({ data: { poolDisplayId } });
    toast.add({
      type: "success",
      title: "Successfully created new sheet",
    });
    navigate({ to: "/sheet/$sheetDisplayId", params: { sheetDisplayId: newSheet.display_id } });
    queryClient.invalidateQueries({ queryKey: ["sheets"] });
  };

  return (
    <>
      <SheetRules />
      {(sheets === null || sheets === undefined || sheets.length === 0) && (
        <>
          <Cta34
            heading="Create a Sheet"
            description="Make selections and view results"
            buttons={[
              <Button key="create-button" variant="default" size="lg" onClick={createHandler}>
                Create
              </Button>,
            ]}
          ></Cta34>
        </>
      )}
    </>
  );
}
