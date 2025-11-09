import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLatestLighthouseRun, triggerLighthouseRun } from "@/lib/api";
import type { LighthouseRunRecord } from "@/types/lighthouse";
import { useToast } from "@/hooks/use-toast";

const queryKey = (url: string | null) => ["lighthouse-run", url] as const;

const formatTimestamp = (iso?: string) => {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
};

export const useLighthouseRun = (url: string | null | undefined) => {
  const normalizedUrl = url?.trim() || null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery<LighthouseRunRecord | null>({
    queryKey: queryKey(normalizedUrl),
    queryFn: () => fetchLatestLighthouseRun(normalizedUrl!),
    enabled: Boolean(normalizedUrl),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
    refetchOnReconnect: true,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!normalizedUrl) {
        throw new Error("URL is required to run Lighthouse tests.");
      }
      return triggerLighthouseRun(normalizedUrl);
    },
    onSuccess: (record) => {
      queryClient.setQueryData(queryKey(normalizedUrl), record);
      toast({
        title: "Lighthouse test completed",
        description: `Updated ${formatTimestamp(record.createdAt)}`,
      });
    },
    onError: (error: unknown) => {
      const description =
        error instanceof Error
          ? error.message.includes("Failed to fetch")
            ? "Could not reach the Lighthouse API. Is `npm run server` running?"
            : error.message
          : "Unable to run Lighthouse.";
      toast({
        title: "Lighthouse test failed",
        description,
        variant: "destructive",
      });
    },
  });

  return {
    run: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    runTest: mutation.mutateAsync,
    isRunning: mutation.isPending,
    error: query.error ?? mutation.error,
  };
};
