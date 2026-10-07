import type { BoardTeam } from "#/hooks/use-sheet-picks";
import { cn } from "@/lib/utils";

export function TeamLogo({
  team,
  name,
  className,
  muted = false,
}: {
  team: BoardTeam | undefined;
  name: string;
  className?: string;
  muted?: boolean;
}) {
  const wrapperClass = cn(
    "flex size-9 shrink-0 items-center justify-center",
    muted && "opacity-50 grayscale",
    className,
  );

  if (!team?.logo_url) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          wrapperClass,
          "rounded-full bg-muted text-[10px] font-semibold text-muted-foreground",
        )}
      >
        {(team?.abbreviation ?? name).slice(0, 4).toUpperCase()}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={wrapperClass}>
      <img src={team.logo_url} alt="" className="size-full object-contain dark:hidden" />
      <img
        src={team.logo_url.replace("/logos/", "/logos-dark/")}
        alt=""
        className="hidden size-full object-contain dark:block"
      />
    </span>
  );
}
