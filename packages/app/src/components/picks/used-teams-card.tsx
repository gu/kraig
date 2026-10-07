import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeekView } from "./board";
import { TeamLogo } from "./team-logo";

export function UsedTeamsCard({
  weeks,
  selectedWeek,
}: {
  weeks: WeekView[];
  selectedWeek: number;
}) {
  const otherWeeks = weeks.filter((w) => w.week !== selectedWeek && w.picks.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Used in other weeks</CardTitle>
        <CardDescription>A team can only be picked once all season.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {otherWeeks.length === 0 && (
          <p className="text-sm text-muted-foreground">No picks in other weeks yet.</p>
        )}
        {otherWeeks.map((week) => (
          <div key={week.week} className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-muted-foreground">Week {week.week}</div>
            <div className="flex flex-wrap gap-1.5">
              {week.picks.map((pick) => (
                <Badge key={pick.game.game.id} variant="outline" className="h-7 gap-1.5 pl-1">
                  <TeamLogo team={pick.team.team} name={pick.team.name} className="size-5" />
                  {pick.team.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
