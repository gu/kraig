import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "@tanstack/react-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "./ui/field";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/middleware/auth";
import z from "zod";
import db from "@db/client";
import { toast } from "./ui/toast";
import { useId, useState } from "react";
import { CheckIcon, CirclePlus, MinusIcon, PlusIcon } from "lucide-react";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";
import { queryClient } from "#/lib/query-client";
import { useNavigate } from "@tanstack/react-router";
import { useConferences } from "#/hooks/use-pools";
import {
  DEFAULT_POOL_SETTINGS,
  PICK_TYPE_LABELS,
  PICK_TYPES,
  poolSettingsSchema,
  selectedConferences,
  SETTING_LIMITS,
  type PickType,
} from "#/lib/pool-settings";
import { cn } from "@/lib/utils";

const createPool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(poolSettingsSchema.extend({ name: z.string().trim().min(1) }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;

    if (data.conferences !== null) {
      const known = await db
        .selectFrom("ext_conference")
        .select("name")
        .where("name", "in", data.conferences)
        .execute();
      if (known.length !== new Set(data.conferences).size) throw new Error("Unknown conference");
    }

    const newPool = await db
      .insertInto("pool")
      .values({
        name: data.name,
        owner_id: userId,
        conferences: data.conferences,
        max_sheets: data.maxSheets,
        picks_per_week: data.picksPerWeek,
        pick_type: data.pickType,
      })
      .returning(["id", "display_id", "name", "owner_id"])
      .executeTakeFirstOrThrow();

    return newPool;
  });

function NumberStepper({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const { min, max } = SETTING_LIMITS;

  return (
    <Field>
      <FieldLabel id={id}>{label}</FieldLabel>
      <div
        role="group"
        aria-labelledby={id}
        className="flex h-10 items-center overflow-hidden rounded-lg border"
      >
        <Button
          type="button"
          variant="ghost"
          className="h-full rounded-none px-3"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <MinusIcon />
        </Button>
        <output aria-live="polite" className="flex-1 text-center font-semibold tabular-nums">
          {value}
        </output>
        <Button
          type="button"
          variant="ghost"
          className="h-full rounded-none px-3"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <PlusIcon />
        </Button>
      </div>
      <FieldDescription className="text-xs">{description}</FieldDescription>
    </Field>
  );
}

export function CreatePoolDialog() {
  const [submitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { data: conferences = [] } = useConferences();
  const conferenceNames = conferences.map((c) => c.name);

  const form = useForm({
    defaultValues: {
      name: "",
      // Every conference is in the pool unless excluded
      excludedConferences: [] as string[],
      maxSheets: DEFAULT_POOL_SETTINGS.maxSheets,
      picksPerWeek: DEFAULT_POOL_SETTINGS.picksPerWeek,
      pickType: DEFAULT_POOL_SETTINGS.pickType as PickType,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      try {
        const newPool = await createPool({
          data: {
            name: value.name,
            conferences: selectedConferences(conferenceNames, value.excludedConferences),
            maxSheets: value.maxSheets,
            picksPerWeek: value.picksPerWeek,
            pickType: value.pickType,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["pools"] });
        navigate({
          to: "/pool/$poolDisplayId",
          params: { poolDisplayId: newPool.display_id },
        });
        toast.add({
          type: "success",
          title: "Successfully created new pool",
        });
        form.reset();
      } catch (e) {
        console.log(e);
        toast.add({
          type: "error",
          title: "Error creating pool",
        });
      }
      setIsSubmitting(false);
      setIsOpen(false);
    },
  });

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger
              render={
                <SidebarMenuButton className="h-12">
                  <CirclePlus />
                  <span>Create a new Pool</span>
                </SidebarMenuButton>
              }
            />
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit();
                }}
              >
                <DialogHeader>
                  <DialogTitle>Create a Pool</DialogTitle>
                  <DialogDescription>
                    Choose the conferences in play and how the pool is scored.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup className="my-6 gap-6">
                  <Field>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <form.Field name="name">
                      {(field) => (
                        <Input
                          id="name"
                          type="text"
                          placeholder="Friends Pool"
                          required
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                        />
                      )}
                    </form.Field>
                  </Field>

                  <form.Field
                    name="excludedConferences"
                    validators={{
                      onChange: ({ value }) =>
                        conferenceNames.length > 0 && value.length >= conferenceNames.length
                          ? "Pick at least one conference."
                          : undefined,
                    }}
                  >
                    {(field) => {
                      const excluded = field.state.value;
                      const noneExcluded = excluded.length === 0;
                      const selectedCount = conferenceNames.length - excluded.length;
                      return (
                        <FieldSet className="gap-0">
                          <div className="mb-2.5 flex items-baseline justify-between gap-3">
                            <FieldLegend variant="label" className="mb-0">
                              Conferences
                            </FieldLegend>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-muted-foreground">
                                {noneExcluded
                                  ? "All conferences"
                                  : `${selectedCount} of ${conferenceNames.length}`}
                              </span>
                              <Button
                                type="button"
                                variant="link"
                                size="xs"
                                className="px-0"
                                onClick={() =>
                                  field.handleChange(noneExcluded ? [...conferenceNames] : [])
                                }
                              >
                                {noneExcluded ? "Clear" : "Select all"}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {conferences.map((conference) => {
                              const selected = !excluded.includes(conference.name);
                              return (
                                <button
                                  key={conference.name}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() =>
                                    field.handleChange(
                                      selected
                                        ? [...excluded, conference.name]
                                        : excluded.filter((name) => name !== conference.name),
                                    )
                                  }
                                  className={cn(
                                    "flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                    selected
                                      ? "border-primary bg-primary/10"
                                      : "bg-card hover:bg-muted",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border",
                                      selected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-muted-foreground/50",
                                    )}
                                  >
                                    {selected && <CheckIcon className="size-3" strokeWidth={3.5} />}
                                  </span>
                                  <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-semibold">
                                      {conference.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {conference.abbreviation}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <FieldError
                            className="mt-2 text-xs"
                            errors={field.state.meta.errors.map((message) => ({
                              message: String(message),
                            }))}
                          />
                        </FieldSet>
                      );
                    }}
                  </form.Field>

                  <form.Field name="pickType">
                    {(field) => (
                      <FieldSet className="gap-0">
                        <FieldLegend variant="label" className="mb-2.5">
                          A pick wins when the team…
                        </FieldLegend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {PICK_TYPES.map((type) => {
                            const selected = field.state.value === type;
                            return (
                              <label
                                key={type}
                                className={cn(
                                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                                  selected ? "border-primary bg-primary/10" : "hover:bg-muted",
                                )}
                              >
                                <input
                                  type="radio"
                                  name="pick-type"
                                  value={type}
                                  checked={selected}
                                  onChange={() => field.handleChange(type)}
                                  className="mt-0.5 size-4 shrink-0 accent-primary outline-none"
                                />
                                <span className="flex min-w-0 flex-col gap-0.5">
                                  <span className="text-sm font-semibold">
                                    {PICK_TYPE_LABELS[type].name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {type === "outright"
                                      ? "Final score only. Spreads are just for reference."
                                      : "Picked team's score plus its spread must beat the opponent."}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </FieldSet>
                    )}
                  </form.Field>

                  <div className="grid grid-cols-2 gap-4">
                    <form.Field name="maxSheets">
                      {(field) => (
                        <NumberStepper
                          label="Sheets per member"
                          description="Most sheets one person can enter"
                          value={field.state.value}
                          onChange={field.handleChange}
                        />
                      )}
                    </form.Field>
                    <form.Field name="picksPerWeek">
                      {(field) => (
                        <NumberStepper
                          label="Picks per week"
                          description="Teams each sheet picks every week"
                          value={field.state.value}
                          onChange={field.handleChange}
                        />
                      )}
                    </form.Field>
                  </div>
                </FieldGroup>
                <DialogFooter>
                  <DialogClose
                    render={
                      <Button type="button" variant={"secondary"}>
                        Close
                      </Button>
                    }
                  />
                  <form.Subscribe selector={(state) => state.canSubmit}>
                    {(canSubmit) => (
                      <Button type="submit" disabled={!canSubmit || submitting}>
                        {submitting ? "Creating Pool..." : "Create Pool"}
                      </Button>
                    )}
                  </form.Subscribe>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
