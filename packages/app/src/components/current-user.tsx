import { createContext, useContext, type ReactNode } from "react";

const CurrentUserContext = createContext<{ name: string; email: string } | undefined>(undefined);

export function CurrentUserProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: { name: string; email: string };
}) {
  return <CurrentUserContext value={user}>{children}</CurrentUserContext>;
}

export function useCurrentUser() {
  const user = useContext(CurrentUserContext);

  if (!user) {
    throw new Error("Unexpected error no user set");
  }

  return user;
}
