import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PICK_TYPE_LABELS, type PoolSettings } from "#/lib/pool-settings";
import { describeScoring } from "#/lib/scoring";

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The pool's settings, with the rules they imply */
export function RulesCard({ settings }: { settings: PoolSettings }) {
  const conferences = settings.conferences ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rules &amp; settings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">Picks per week</dt>
            <dd className="text-xl font-bold tabular-nums">{settings.picksPerWeek}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">Sheets per member</dt>
            <dd className="text-xl font-bold tabular-nums">{settings.maxSheets}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">Picks win by</dt>
            <dd className="text-sm leading-7 font-bold">
              {PICK_TYPE_LABELS[settings.pickType].short}
            </dd>
          </div>
          <div className="col-span-full flex flex-col gap-1.5 rounded-lg bg-muted px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">Conferences</dt>
            <dd className="flex flex-wrap gap-1.5">
              {settings.conferences === null ? (
                <span className="text-sm font-semibold">All conferences</span>
              ) : (
                conferences.map((conference) => (
                  <span
                    key={conference}
                    className="flex h-6.5 items-center rounded-full border bg-card px-2.5 text-xs font-semibold"
                  >
                    {conference}
                  </span>
                ))
              )}
            </dd>
          </div>
        </dl>
        <ul className="flex list-disc flex-col gap-1.5 pl-4.5 text-sm text-muted-foreground">
          <li>
            Make {plural(settings.picksPerWeek, "pick")} each week from{" "}
            {settings.conferences === null ? "any conference" : conferences.join(", ")}.
          </li>
          <li>{PICK_TYPE_LABELS[settings.pickType].rule}</li>
          <li>Each winning pick earns {describeScoring()}. Losses and pushes earn nothing.</li>
          <li>Picks lock at the start of that team's game.</li>
          <li>
            You can only select a team once. After they're chosen, you can't pick them again this
            season.
          </li>
          <li>You can only make picks for the upcoming week.</li>
          <li>Each member can enter up to {plural(settings.maxSheets, "sheet")}.</li>
        </ul>
      </CardContent>
    </Card>
  );
}
