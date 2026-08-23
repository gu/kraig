import { toast } from "#/components/ui/toast";
import { QueryCache, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Avoid showing toasts during background refetches if data already exists
      if (query.state.data !== undefined) return;

      toast.add({
        type: "error",
        title: "Error loading data",
        description: error.message,
      });
    },
  }),
});
