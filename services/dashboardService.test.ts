import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./campaignService', () => ({
  campaignService: {
    getAll: vi.fn(),
    list: vi.fn(),
  },
}))

import { campaignService } from './campaignService'
import { dashboardService } from './dashboardService'

import { createMockFetchResponse, setupFetchMock } from '@/tests/helpers'

describe('dashboardService', () => {
  const mockFetch = setupFetchMock()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('getStats deve combinar stats e chartData vindos da API', async () => {
    // chartData agora vem pronto da API (agregado no Postgres via
    // get_campaign_daily_stats), não é mais calculado a partir de
    // campaignService.getAll() no client.
    const chartData = Array.from({ length: 30 }, (_, i) => ({
      name: `0${i + 1}/01`,
      sent: 1,
      read: 1,
      delivered: 1,
      failed: 0,
      active: 0,
    }))

    mockFetch.mockResolvedValueOnce(createMockFetchResponse({
      totalSent: 10,
      totalDelivered: 8,
      totalRead: 5,
      totalFailed: 2,
      activeCampaigns: 1,
      deliveryRate: 80,
      chartData,
    }))

    const result = await dashboardService.getStats()

    expect(result.sent24h).toBe('10')
    expect(result.deliveryRate).toBe('80%')
    expect(result.chartData).toHaveLength(30)
  })

  it('getStats deve usar defaults quando stats falha', async () => {
    mockFetch.mockResolvedValueOnce(createMockFetchResponse({}, { ok: false }))

    const result = await dashboardService.getStats()

    expect(result.sent24h).toBe('0')
    expect(result.failedMessages).toBe('0')
    expect(result.chartData).toEqual([])
  })

  it('getRecentCampaigns deve retornar lista', async () => {
    ;(campaignService.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [{ id: 'c1' }],
    })

    const result = await dashboardService.getRecentCampaigns()

    expect(result).toHaveLength(1)
  })

  it('getRecentCampaigns deve retornar vazio em erro', async () => {
    ;(campaignService.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'))

    const result = await dashboardService.getRecentCampaigns()

    expect(result).toEqual([])
  })
})
