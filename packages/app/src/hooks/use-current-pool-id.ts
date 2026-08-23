import { useLocalStorage } from "usehooks-ts";

export function useCurrentPoolId() {
  const [value, setValue, removeValue] = useLocalStorage<string | undefined>(
    "current-pool-id",
    undefined,
  );

  if (value && typeof value !== "string") {
    removeValue();
  }

  return { currentPoolId: value, setCurrentPoolId: setValue };
}
