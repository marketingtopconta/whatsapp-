'use client'

import { useQuery } from '@tanstack/react-query'
import type {
  CRMSummary,
  StageConversionRate,
  LeadsTimelinePoint,
  AttendantPerformance,
  LeadsBySource,
  CRMAnalyticsParams,
} from '@/types'

const BASE = '/api/crm/analytics'

function buildParams(params: CRMAnalyticsParams) {
  const p = new URLSearchParams()
  if (params.funnelId) p.set('funnelId', params.funnelId)
  if (params.startDate) p.set('startDate', params.startDate)
  if (params.endDate) p.set('endDate', params.endDate)
  if (params.days) p.set('days', String(params.days))
  return p.toString()
}

async function fetchSummary(params: CRMAnalyticsParams): Promise<CRMSummary> {
  const res = await fetch(`${BASE}/summary?${buildParams(params)}`)
  if (!res.ok) throw new Error('Erro ao buscar resumo')
  return res.json()
}

async function fetchConversion(params: CRMAnalyticsParams): Promise<StageConversionRate[]> {
  const res = await fetch(`${BASE}/conversion?${buildParams(params)}`)
  if (!res.ok) throw new Error('Erro ao buscar conversão')
  return res.json()
}

async function fetchTimeline(params: CRMAnalyticsParams): Promise<LeadsTimelinePoint[]> {
  const res = await fetch(`${BASE}/timeline?${buildParams(params)}`)
  if (!res.ok) throw new Error('Erro ao buscar timeline')
  return res.json()
}

async function fetchAttendants(params: CRMAnalyticsParams): Promise<AttendantPerformance[]> {
  const res = await fetch(`${BASE}/attendants?${buildParams(params)}`)
  if (!res.ok) throw new Error('Erro ao buscar atendentes')
  return res.json()
}

async function fetchBySource(params: CRMAnalyticsParams): Promise<LeadsBySource[]> {
  const res = await fetch(`${BASE}/source?${buildParams(params)}`)
  if (!res.ok) throw new Error('Erro ao buscar fontes')
  return res.json()
}

export function useCRMAnalytics(params: CRMAnalyticsParams = {}) {
  const key = [params.funnelId ?? 'all', params.startDate, params.endDate, params.days]

  const summary = useQuery({
    queryKey: ['crm-analytics-summary', ...key],
    queryFn: () => fetchSummary(params),
    staleTime: 60_000,
  })

  const conversion = useQuery({
    queryKey: ['crm-analytics-conversion', ...key],
    queryFn: () => fetchConversion(params),
    staleTime: 60_000,
  })

  const timeline = useQuery({
    queryKey: ['crm-analytics-timeline', ...key],
    queryFn: () => fetchTimeline(params),
    staleTime: 60_000,
  })

  const attendants = useQuery({
    queryKey: ['crm-analytics-attendants', ...key],
    queryFn: () => fetchAttendants(params),
    staleTime: 60_000,
  })

  const bySource = useQuery({
    queryKey: ['crm-analytics-source', ...key],
    queryFn: () => fetchBySource(params),
    staleTime: 60_000,
  })

  const isLoading =
    summary.isLoading || conversion.isLoading || timeline.isLoading || attendants.isLoading || bySource.isLoading

  return {
    summary: summary.data,
    conversionRates: conversion.data ?? [],
    timeline: timeline.data ?? [],
    attendants: attendants.data ?? [],
    bySource: bySource.data ?? [],
    isLoading,
    refetch: () => {
      summary.refetch()
      conversion.refetch()
      timeline.refetch()
      attendants.refetch()
      bySource.refetch()
    },
  }
}
