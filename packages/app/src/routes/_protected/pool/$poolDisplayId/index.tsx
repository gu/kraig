import { Button } from "#/components/ui/button";
import { RulesCard } from "#/components/rules-card";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { LeaderboardCard } from "#/components/leaderboard/leaderboard-card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "#/components/ui/item";
import { Skeleton } from "#/components/ui/skeleton";
import { toast } from "#/components/ui/toast";
import { useLeaderboard } from "#/hooks/use-leaderboard";
import { usePool } from "#/hooks/use-pools";
import { formatStanding } from "#/lib/scoring";
import { useSheets } from "#/hooks/use-sheets";
import { cn } from "@/lib/utils";
import { queryClient } from "#/lib/query-client";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ChevronRightIcon, FileSpreadsheet } from "lucide-react";
import z from "zod";

export const Route = createFileRoute("/_protected/pool/$poolDisplayId/")({
  component: PoolDashboard,
});

const createEmptySheet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ poolDisplayId: z.string() }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const pooldisplayId = data.poolDisplayId;

    return db.transaction().execute(async (trx) => {
      const pool = await trx
        .selectFrom("pool")
        .select(["id", "max_sheets"])
        .where("owner_id", "=", userId)
        .where("display_id", "=", pooldisplayId)
        // Serialize sheet creation per pool so concurrent requests can't pass the limit
        .forUpdate()
        .executeTakeFirstOrThrow();

      const { count } = await trx
        .selectFrom("sheet")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("pool_id", "=", pool.id)
        .where("owner_id", "=", userId)
        .executeTakeFirstOrThrow();
      if (Number(count) >= pool.max_sheets) {
        throw new Error(`This pool allows ${pool.max_sheets} sheets per member`);
      }

      return trx
        .insertInto("sheet")
        .values({
          name: "New Sheet",
          owner_id: userId,
          pool_id: pool.id,
        })
        .returning(["id", "display_id", "name", "owner_id"])
        .executeTakeFirstOrThrow();
    });
  });

function PoolDashboard() {
  const { poolDisplayId } = Route.useParams();
  const navigate = useNavigate();

  const { data: pool } = usePool(poolDisplayId);
  const { data: sheets } = useSheets({ poolDisplayId });
  const { data: leaderboard } = useLeaderboard(poolDisplayId);

  /** e.g. "T-3rd of 12 · 36 pts", once the pool has results */
  const sheetSummary = (sheetId: number) => {
    const row = leaderboard?.rows.find((r) => r.id === sheetId);
    if (!leaderboard || leaderboard.throughWeek === null || !row) return null;
    const standing = formatStanding({ ...row, of: leaderboard.rows.length });
    return `${standing} · ${row.points} ${row.points === 1 ? "pt" : "pts"}`;
  };

  const maxSheets = pool?.settings.maxSheets;
  const sheetCount = sheets?.length ?? 0;
  const atLimit = maxSheets !== undefined && sheetCount >= maxSheets;

  const createHandler = async () => {
    try {
      const newSheet = await createEmptySheet({ data: { poolDisplayId } });
      toast.add({
        type: "success",
        title: "Successfully created new sheet",
      });
      navigate({
        to: "/pool/$poolDisplayId/sheet/$sheetDisplayId",
        params: { poolDisplayId, sheetDisplayId: newSheet.display_id },
      });
    } catch (e) {
      toast.add({
        type: "error",
        title: "Couldn't create sheet",
        description: e instanceof Error ? e.message : undefined,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["sheets"] });
    queryClient.invalidateQueries({ queryKey: ["leaderboard", poolDisplayId] });
  };

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold">{pool?.name}</h1>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leaderboard ? (
            <LeaderboardCard leaderboard={leaderboard} poolDisplayId={poolDisplayId} />
          ) : (
            <Skeleton className="h-80 w-full" />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Your Sheets</CardTitle>
              {maxSheets !== undefined && (
                <CardAction className="text-sm text-muted-foreground tabular-nums">
                  {sheetCount} of {maxSheets}
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-2">
              {maxSheets !== undefined && (
                <div className="flex gap-1 px-2" aria-hidden="true">
                  {Array.from({ length: maxSheets }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        i < sheetCount ? "bg-primary" : "bg-muted",
                      )}
                    />
                  ))}
                </div>
              )}
              <ItemGroup>
                {(sheets ?? []).map((sheet) => {
                  return (
                    <Item
                      key={sheet.id}
                      variant="muted"
                      render={
                        <Link
                          to="/pool/$poolDisplayId/sheet/$sheetDisplayId"
                          params={{ poolDisplayId, sheetDisplayId: sheet.display_id }}
                        />
                      }
                    >
                      <ItemMedia variant="icon">
                        <FileSpreadsheet />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{sheet.name}</ItemTitle>
                        {sheetSummary(sheet.id) && (
                          <ItemDescription>{sheetSummary(sheet.id)}</ItemDescription>
                        )}
                      </ItemContent>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    </Item>
                  );
                })}
              </ItemGroup>
              {atLimit && (
                <p className="mx-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                  You've entered the most sheets this pool allows ({maxSheets}).
                </p>
              )}
            </CardContent>
            {!atLimit && (
              <CardFooter>
                <Button
                  className="w-full"
                  variant="default"
                  size="sm"
                  disabled={maxSheets === undefined}
                  onClick={createHandler}
                >
                  Create Sheet
                </Button>
              </CardFooter>
            )}
          </Card>

          {pool ? <RulesCard settings={pool.settings} /> : <Skeleton className="h-80 w-full" />}
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
                                  to: "/pool/$poolDisplayId/sheet/$sheetDisplayId",
                                  params: { poolDisplayId, sheetDisplayId: sheet.display_id },
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
