import { useLocalStorage } from "usehooks-ts";
import z from "zod";

const CurrentPoolIdStorageSchema = z.object({
  id: z.number(),
  displayId: z.string(),
});

type CurrentPoolIdStorage = z.infer<typeof CurrentPoolIdStorageSchema>;

export function useCurrentPoolId() {
  const [value, setValue] = useLocalStorage<CurrentPoolIdStorage | undefined>(
    "current-pool-id",
    undefined,
  );

  return { currentPoolId: value, setCurrentPoolId: setValue };
}
