import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: () => <Login />,
});

function Login() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Login</h1>
    </div>
  );
}
