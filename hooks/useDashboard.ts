import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { useCentralizedRealtime, useRealtimeSubscription } from '@/components/providers/CentralizedRealtimeProvider';

// Fallback polling: só entra em ação se a conexão Realtime estiver indisponível
const FALLBACK_POLLING_INTERVAL = 30000;

export const useDashboardController = (initialData?: { stats: any, recentCampaigns: any[] }) => {
  const queryClient = useQueryClient();
  const { isConnected } = useCentralizedRealtime();
  const fallbackInterval = isConnected ? false : FALLBACK_POLLING_INTERVAL;

  const statsQuery = useQuery({
    queryKey: ['dashboardStats', 'v2'],
    queryFn: dashboardService.getStats,
    initialData: initialData?.stats,
    placeholderData: (previous) => previous,
    refetchInterval: fallbackInterval,
    staleTime: 20_000, // 20 seconds - avoids refetch when switching tabs
    gcTime: 5 * 60 * 1000, // 5 minutes - keep data longer in cache
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const recentCampaignsQuery = useQuery({
    queryKey: ['recentCampaigns'],
    queryFn: dashboardService.getRecentCampaigns,
    initialData: initialData?.recentCampaigns,
    placeholderData: (previous) => previous,
    refetchInterval: fallbackInterval,
    staleTime: 20000,
    gcTime: 120000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Um único canal Realtime (via CentralizedRealtimeProvider) cobre as duas queries
  // acima, em vez de cada uma abrir sua própria subscription para a tabela 'campaigns'.
  const invalidateCampaigns = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboardStats', 'v2'] });
    queryClient.invalidateQueries({ queryKey: ['recentCampaigns'] });
  }, [queryClient]);

  useRealtimeSubscription('campaigns', invalidateCampaigns);

  return {
    stats: statsQuery.data,
    recentCampaigns: recentCampaignsQuery.data,
    isLoading: statsQuery.isLoading && !statsQuery.data,
    isFetching: statsQuery.isFetching || recentCampaignsQuery.isFetching,
    isError: statsQuery.isError || recentCampaignsQuery.isError,
    refetch: async () => {
      // Refetch em paralelo para evitar waterfall
      await Promise.all([
        statsQuery.refetch(),
        recentCampaignsQuery.refetch(),
      ]);
    }
  };
};
