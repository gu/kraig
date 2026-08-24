import { SheetRules } from "#/components/sheet-rules";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty";
import { toast } from "#/components/ui/toast";
import { useSheets } from "#/hooks/use-sheets";
import { queryClient } from "#/lib/query-client";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { PlusIcon } from "lucide-react";
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
      <section className="py-16">
        <div className="container mx-auto">
          <div className="border-t pt-14">
            {(sheets === null || sheets === undefined || sheets.length === 0) && (
              <>
                <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
                  <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                    Create a Sheet
                  </h2>
                  <p className="max-w-2xl text-muted-foreground lg:text-lg">
                    Make selections and view game results
                  </p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <Button variant="default" size="lg" onClick={createHandler}>
                      Create
                    </Button>
                  </div>
                </div>
              </>
            )}
            {sheets !== null && sheets !== undefined && sheets.length > 0 && (
              <>
                <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
                  <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Your Sheets</h2>
                  <div className="flex flex-wrap gap-4 w-full px-8">
                    {(sheets ?? []).map((sheet) => {
                      return (
                        <Card key={sheet.id} className="w-72 mx-auto shrink-0">
                          <CardHeader>
                            <CardTitle>{sheet.name}</CardTitle>
                          </CardHeader>
                          <CardContent className="h-full"></CardContent>
                          <CardFooter>
                            <Button
                              className="w-full"
                              onClick={() => {
                                navigate({
                                  to: "/sheet/$sheetDisplayId",
                                  params: { sheetDisplayId: sheet.display_id },
                                });
                              }}
                            >
                              View Sheet
                            </Button>
                          </CardFooter>
                        </Card>
                      );
                    })}
                    <Card className="w-72 mx-auto shrink-0">
                      <CardContent>
                        <Empty className="p-4">
                          <EmptyMedia variant="icon">
                            <PlusIcon />
                          </EmptyMedia>
                          <EmptyHeader>
                            <EmptyTitle>Create New Sheet</EmptyTitle>
                            <EmptyDescription>Create an additional sheet.</EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <Button variant="default" size="lg" onClick={createHandler}>
                              Create Sheet
                            </Button>
                          </EmptyContent>
                        </Empty>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
