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
import { CirclePlus } from "lucide-react";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";
import { queryClient } from "#/lib/query-client";

const createPool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ name: z.string() }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const poolName = data.name;

    const newPool = await db
      .insertInto("pool")
      .values({
        name: poolName,
        owner_id: userId,
      })
      .returning(["id", "name", "owner_id"])
      .executeTakeFirstOrThrow();

    return newPool;
  });

export function CreatePoolDialog() {
  const [submitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      console.log(value);
      try {
        await createPool({ data: { ...value } });
        await queryClient.invalidateQueries({ queryKey: ["pools"] });
        toast.add({
          type: "success",
          title: "Successfully created new pool",
        });
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
            <DialogContent className="sm:max-w-md">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit();
                }}
              >
                <DialogHeader>
                  <DialogTitle>Create a Pool</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                  <Field className="my-6">
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
                </FieldGroup>
                <DialogFooter>
                  <DialogClose
                    render={
                      <Button type="button" variant={"secondary"}>
                        Close
                      </Button>
                    }
                  />
                  <Button type="submit">{submitting ? "Creating Pool..." : "Create Pool"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
