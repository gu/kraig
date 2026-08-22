import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { auth } from "#/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "./ui/toast";

const SignUpSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
});

const signUp = createServerFn({ method: "POST" })
  .validator(SignUpSchema)
  .handler(async ({ data }) => {
    const resp = await auth.api.signUpEmail({
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
      },
    });

    return resp.user;
  });

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      try {
        await signUp({ data: { ...value } });
      } catch (e) {
        console.log(e);
        toast.add({
          type: "error",
          title: "Sign Up error",
        });
      }
      toast.add({
        type: "success",
        title: "Sign Up Successful",
      });
      navigate({ to: "/" });
    },
  });

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Enter your information below to create your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <form.Field name="name">
                {(field) => (
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    required
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <form.Field name="email">
                {(field) => (
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
              <FieldDescription>
                We&apos;ll use this to contact you. We will not share your email with anyone else.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <form.Field name="password">
                {(field) => (
                  <Input
                    id="password"
                    type="password"
                    required
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
              <FieldDescription>Must be at least 8 characters long.</FieldDescription>
            </Field>
            <Field>
              <Button type="submit">Create Account</Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
