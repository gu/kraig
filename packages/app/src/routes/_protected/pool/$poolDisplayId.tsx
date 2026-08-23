import { Cta34 } from "#/components/cta34";
import { SheetRules } from "#/components/sheet-rules";
import { Button } from "#/components/ui/button";
import { useSheets } from "#/hooks/use-sheets";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { createFileRoute } from "@tanstack/react-router";
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
      .returning(["id", "name", "owner_id"])
      .executeTakeFirstOrThrow();
  });

function PoolDashboard() {
  const { poolDisplayId } = Route.useParams();

  const { data: sheets } = useSheets({ poolDisplayId });

  const createHandler = async () => {
    const newSheet = await createEmptySheet({ data: { poolDisplayId } });
    console.log(newSheet);
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
