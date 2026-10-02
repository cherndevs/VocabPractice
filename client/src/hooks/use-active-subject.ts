import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Settings, Subject } from "@shared/schema";

// The active Workspace's Subject lives in the global settings so it survives
// restarts. `subject` is undefined until settings have loaded; the server
// reports "english" when none has ever been chosen.
export function useActiveSubject() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });

  const switchSubject = useMutation({
    mutationFn: async (subject: Subject) => {
      const response = await apiRequest("PUT", "/api/settings", { activeSubject: subject });
      return response.json();
    },
    // Switch the list immediately; the save happens in the background.
    onMutate: async (subject) => {
      await queryClient.cancelQueries({ queryKey: ["/api/settings"] });
      const previous = queryClient.getQueryData<Settings>(["/api/settings"]);
      queryClient.setQueryData<Settings>(["/api/settings"], (old) =>
        old ? { ...old, activeSubject: subject } : old,
      );
      return { previous };
    },
    onError: (_error, _subject, context) => {
      queryClient.setQueryData(["/api/settings"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  return {
    subject: settings?.activeSubject ?? undefined,
    setSubject: (subject: Subject) => switchSubject.mutate(subject),
  };
}
