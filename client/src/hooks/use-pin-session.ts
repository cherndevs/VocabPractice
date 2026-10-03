import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Pins a session if it is unpinned, unpins it otherwise. Every screen that
// lists sessions reads from one of these queries, so all of them refresh.
export function usePinSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (session: { id: string; pinnedAt: unknown }) => {
      const pinnedAt = session.pinnedAt ? null : new Date().toISOString();
      const response = await apiRequest("PUT", `/api/sessions/${session.id}`, { pinnedAt });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
    },
  });
}
