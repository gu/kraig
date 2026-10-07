import type { TeamView } from "./board";

/** Team name with its AP rank for the week, when ranked */
export function TeamName({ team }: { team: Pick<TeamView, "name" | "rank"> }) {
  return (
    <>
      {team.rank !== null && (
        <span className="mr-1 text-xs font-medium text-muted-foreground tabular-nums">
          #{team.rank}
        </span>
      )}
      {team.name}
    </>
  );
}
