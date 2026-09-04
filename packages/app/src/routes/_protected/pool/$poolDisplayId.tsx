import { Button } from "#/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "#/components/ui/item";
import { toast } from "#/components/ui/toast";
import { useSheets } from "#/hooks/use-sheets";
import { queryClient } from "#/lib/query-client";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ChevronRightIcon, FileSpreadsheet } from "lucide-react";
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 p-4">
          <section className="py-2">
            <Card>
              <CardHeader>
                <CardTitle>Rules</CardTitle>
              </CardHeader>
              <CardContent className="px-10">
                <ul className="list-disc gap-1 flex flex-col text-xs">
                  <li>Picks lock at the start of that teams game</li>
                  <li>
                    You can only select a team once. After they are chosen, you will not be allowed
                    to select them for the rest of the year.
                  </li>
                  <li>You will only be able to make picks for the upcoming week</li>
                  <li>You will have 3 lives. Every wrong pick will eliminate a life</li>
                  <li>Once all 3 of your lives are gone, you will be eliminated</li>
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="px-4">
          <section className="py-2">
            <Card>
              <CardHeader>
                <CardTitle>Your Sheets</CardTitle>
              </CardHeader>
              <CardContent className="px-2">
                <ItemGroup>
                  {(sheets ?? []).map((sheet) => {
                    return (
                      <Item
                        key={sheet.id}
                        variant="muted"
                        render={
                          <Link
                            to="/sheet/$sheetDisplayId"
                            params={{ sheetDisplayId: sheet.display_id }}
                          />
                        }
                      >
                        <ItemMedia variant="icon">
                          <FileSpreadsheet />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{sheet.name}</ItemTitle>
                        </ItemContent>
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      </Item>
                    );
                  })}
                </ItemGroup>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="default" size="sm" onClick={createHandler}>
                  Create Sheet
                </Button>
              </CardFooter>
            </Card>
          </section>
        </div>

        <div className="px-4">
          <section className="py-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 10</CardTitle>
              </CardHeader>
              <CardContent className="px-10"></CardContent>
              <CardFooter>
                <Button className="w-full" variant="default" size="sm" onClick={createHandler}>
                  View Leaderboard
                </Button>
              </CardFooter>
            </Card>
          </section>
        </div>
      </div>

      {/* <SheetRules />
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
      </section> */}
    </>
  );
}
