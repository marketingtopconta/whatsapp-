import { Campaign } from '../types';
import { campaignService } from './campaignService';

export interface ChartDataPoint {
  name: string;
  sent: number;
  read: number;
  delivered: number;
  failed: number;
  active: number;
}

export interface DashboardStats {
  sent24h: string;
  deliveryRate: string;
  activeCampaigns: string;
  failedMessages: string;
  chartData: ChartDataPoint[];
}

// API response from /api/dashboard/stats
interface StatsAPIResponse {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  activeCampaigns: number;
  deliveryRate: number;
  chartData?: ChartDataPoint[];
}

export const dashboardService = {
  /**
   * Buscar stats do dashboard direto da API otimizada.
   * A API faz uma única query SQL agregada no servidor (incluindo os dados
   * do gráfico de 30 dias via RPC get_campaign_daily_stats) - não baixamos
   * mais a lista completa de campanhas para agregar no client.
   * Observação: sem cache para manter o dashboard “ao vivo”.
   */
  getStats: async (): Promise<DashboardStats> => {
    const statsResponse = await fetch('/api/dashboard/stats', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    const stats: StatsAPIResponse = statsResponse.ok
      ? await statsResponse.json()
      : { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, activeCampaigns: 0, deliveryRate: 0, chartData: [] };

    return {
      sent24h: stats.totalSent.toLocaleString(),
      deliveryRate: `${stats.deliveryRate}%`,
      activeCampaigns: stats.activeCampaigns.toString(),
      failedMessages: stats.totalFailed.toString(),
      chartData: stats.chartData ?? [],
    };
  },

  /**
   * Buscar campanhas recentes (top 5).
   * Sem cache para manter o dashboard “ao vivo”.
   */
  getRecentCampaigns: async (): Promise<Campaign[]> => {
    try {
      const result = await campaignService.list({ limit: 5, offset: 0, search: '', status: 'All' });
      return result.data || [];
    } catch {
      return [];
    }
  }
};
