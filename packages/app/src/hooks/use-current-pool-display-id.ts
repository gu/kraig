import { useParams } from "@tanstack/react-router";

export function useCurrentPoolDisplayId() {
  const { poolDisplayId } = useParams({ strict: false });

  return poolDisplayId;
}
