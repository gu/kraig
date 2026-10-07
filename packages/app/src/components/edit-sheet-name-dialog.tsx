import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/middleware/auth";
import z from "zod";
import db from "@db/client";
import { toast } from "./ui/toast";
import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { queryClient } from "#/lib/query-client";

const updateSheetName = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ sheetDisplayId: z.string(), name: z.string().trim().min(1) }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;

    return db
      .updateTable("sheet")
      .set({ name: data.name, updated_at: new Date() })
      .where("owner_id", "=", userId)
      .where("display_id", "=", data.sheetDisplayId)
      .returning(["id", "display_id", "name"])
      .executeTakeFirstOrThrow();
  });

export function EditSheetNameDialog({
  sheetDisplayId,
  currentName,
}: {
  sheetDisplayId: string;
  currentName: string;
}) {
  const [submitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: currentName,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      try {
        await updateSheetName({ data: { sheetDisplayId, name: value.name } });
        await queryClient.invalidateQueries({ queryKey: ["sheets"] });
        toast.add({
          type: "success",
          title: "Successfully renamed sheet",
        });
        setIsOpen(false);
      } catch (e) {
        console.log(e);
        toast.add({
          type: "error",
          title: "Error renaming sheet",
        });
      }
      setIsSubmitting(false);
    },
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          form.reset({ name: currentName });
        }
        setIsOpen(open);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Edit sheet name">
            <PencilIcon />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename Sheet</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field className="my-6">
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <form.Field name="name">
                {(field) => (
                  <Input
                    id="name"
                    type="text"
                    required
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant={"secondary"}>
                  Close
                </Button>
              }
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
