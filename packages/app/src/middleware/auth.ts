import { auth } from "#/lib/auth";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();

  if (!request) {
    throw new Error("No request context found");
  }

  // Better Auth reads the session headers from this request
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Inject user and session details into the context pipeline
  return next({
    context: {
      user: session.user,
      session: session.session,
    },
  });
});
