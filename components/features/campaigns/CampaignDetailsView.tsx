'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { CampaignStatus } from '@/types';
import { Page } from '@/components/ui/page';
import { ContactQuickEditModal } from '@/components/features/contacts/ContactQuickEditModal';
import { computeCampaignUiCounters } from '@/lib/campaign-ui-counters';
import { CampaignTracePanel } from './CampaignTracePanel';
import { useDevMode } from '@/components/providers/DevModeProvider';

// Extracted components
import {
  CampaignHeader,
  CampaignStatsGrid,
  CampaignPerformancePanel,
  CampaignTelemetryPanel,
  CampaignFlowPanel,
  MessageLogTable,
  PreparingCampaignView,
  CampaignDetailsViewProps,
  getCampaignStatusClass,
  formatScheduledTime,
  formatEtaMs,
  computeBaselineThroughputMedian,
  computePerfSourceLabel,
  computeLimiterInfo,
} from './details';

// Lazy-load TemplatePreviewModal (raramente usado)
const TemplatePreviewModal = dynamic(
  () => import('./details/TemplatePreviewModal').then((m) => ({ default: m.TemplatePreviewModal })),
  { loading: () => null }
);

export const CampaignDetailsView: React.FC<CampaignDetailsViewProps> = ({
  campaign,
  messages,
  messageStats,
  realStats,
  metrics,
  isLoading,
  searchTerm,
  setSearchTerm,
  navigate,
  onPause,
  onResume,
  onStart,
  onCancelSchedule,
  onCancelSend,
  onResendSkipped,
  isPausing,
  isResuming,
  isStarting,
  isCancelingSchedule,
  isCancelingSend,
  isResendingSkipped,
  canPause,
  canResume,
  canStart,
  canCancelSchedule,
  canCancelSend,
  isRealtimeConnected,
  shouldShowRefreshButton,
  isRefreshing,
  refetch,
  filterStatus,
  setFilterStatus,
  telemetry,
  onLoadMore,
  canLoadMore,
  isLoadingMore,
  includeReadInDelivered,
  setIncludeReadInDelivered,
}) => {
  // Dev mode hook
  const { isDevMode } = useDevMode();

  // Local state
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [isPerfOpen, setIsPerfOpen] = useState(false);
  const [quickEditContactId, setQuickEditContactId] = useState<string | null>(null);
  const [quickEditFocus, setQuickEditFocus] = useState<any>(null);

  // Extract metrics data
  const perf = metrics?.current || null;
  const baseline = Array.isArray(metrics?.baseline) ? metrics.baseline : [];

  // Computed values
  const baselineThroughputMedian = useMemo(() => {
    return computeBaselineThroughputMedian(baseline);
  }, [baseline]);

  const perfSourceLabel = useMemo(() => {
    return computePerfSourceLabel(metrics?.source);
  }, [metrics?.source]);

  const limiterInfo = useMemo(() => {
    return computeLimiterInfo(perf, metrics?.source);
  }, [metrics?.source, perf?.meta_avg_ms, perf?.saw_throughput_429]);

  // Temporizador: força um re-render a cada segundo enquanto a campanha está
  // enviando, para o "tempo decorrido" e a estimativa de conclusão avançarem
  // sozinhos na tela, sem precisar de refresh/polling do usuário.
  // IMPORTANTE: precisa ficar antes dos `return` condicionais abaixo (regra dos Hooks),
  // por isso usa optional chaining em `campaign?.status` em vez de `isSendingNow`.
  const [, forceTimerTick] = useState(0);
  const isSendingNowForTimer = campaign?.status === CampaignStatus.SENDING;
  useEffect(() => {
    if (!isSendingNowForTimer) return;
    const interval = setInterval(() => forceTimerTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isSendingNowForTimer]);

  // Loading state
  if (isLoading || !campaign) {
    return <div className="p-10 text-center text-gray-500">Carregando...</div>;
  }

  // Temp campaign state (preparing)
  const isTempCampaign = campaign.id?.startsWith('temp_');
  if (isTempCampaign) {
    return <PreparingCampaignView campaign={campaign} messages={messages} />;
  }

  // Compute skipped count
  const skippedCount = messageStats?.skipped ?? realStats?.skipped ?? campaign.skipped ?? 0;

  // Live stats for cards
  const liveStats = messageStats ?? realStats ?? null;
  const hasLiveStats = Boolean(liveStats);

  // UI counters
  const uiCounters = computeCampaignUiCounters({
    campaign: {
      sent: campaign.sent,
      delivered: campaign.delivered,
      read: campaign.read,
      failed: campaign.failed,
    },
    live: liveStats,
  });

  const sentCountForUi = uiCounters.sent;
  const deliveredTotalForUi = uiCounters.deliveredTotal;
  const readCountForUi = uiCounters.read;
  const failedCountForUi = uiCounters.failed;
  const deliveredOnlyCountForUi = uiCounters.delivered;

  // Performance metrics (live)
  const isSendingNow = campaign.status === CampaignStatus.SENDING;
  const isCompletedNow = campaign.status === CampaignStatus.COMPLETED;

  const startedAtMs = campaign.startedAt ? new Date(campaign.startedAt).getTime() : null;
  const completedAtMs = campaign.completedAt ? new Date(campaign.completedAt).getTime() : null;
  const elapsedMs = startedAtMs ? (completedAtMs ?? Date.now()) - startedAtMs : null;

  // Estimativa de tempo restante: usa a taxa observada até agora (processados / tempo decorrido)
  // e projeta pros contatos que ainda faltam. Simples de propósito — não depende das métricas
  // avançadas (dev-only) de campaign_run_metrics, então funciona pra qualquer usuário.
  const processedForRate = sentCountForUi + deliveredTotalForUi + failedCountForUi;
  const pendingForEta = Math.max(0, (campaign.recipients ?? 0) - processedForRate - skippedCount);
  const rateMsgsPerMs = (elapsedMs && elapsedMs > 0 && processedForRate > 0) ? processedForRate / elapsedMs : null;
  const etaMs = (isSendingNow && rateMsgsPerMs && pendingForEta > 0) ? pendingForEta / rateMsgsPerMs : null;

  const durationValue = (isSendingNow || isCompletedNow) ? formatEtaMs(elapsedMs) : '—';
  const durationSubvalue = isCompletedNow
    ? 'Concluida'
    : isSendingNow
      ? (etaMs != null ? `~${formatEtaMs(etaMs)} restantes` : 'Calculando estimativa...')
      : (campaign.status === CampaignStatus.CANCELLED ? 'Cancelada' : 'Ainda nao iniciou');
  const durationIsLive = isSendingNow;

  const dispatchStartIso = (perf as any)?.first_dispatch_at || (campaign as any)?.firstDispatchAt || null;
  const dispatchEndIsoFromDb = (perf as any)?.last_sent_at || (campaign as any)?.lastSentAt || null;
  const dispatchEndIsoEstimated = (!dispatchEndIsoFromDb && isSendingNow && dispatchStartIso)
    ? new Date().toISOString()
    : null;
  const dispatchEndIso = dispatchEndIsoFromDb || dispatchEndIsoEstimated;
  const dispatchDurationMsLive = (dispatchStartIso && dispatchEndIso)
    ? Math.max(0, new Date(dispatchEndIso).getTime() - new Date(dispatchStartIso).getTime())
    : null;
  const throughputMpsLive = (dispatchDurationMsLive && dispatchDurationMsLive > 0)
    ? (Number(sentCountForUi || 0) / (dispatchDurationMsLive / 1000))
    : null;
  const isPerfEstimatedLive = Boolean(dispatchEndIsoEstimated);
  const throughputMpsForUi = isPerfEstimatedLive ? throughputMpsLive : Number(perf?.throughput_mps);
  const dispatchDurationMsForUi = isPerfEstimatedLive ? dispatchDurationMsLive : Number(perf?.dispatch_duration_ms);

  // Formatted values
  const scheduledTimeDisplay = formatScheduledTime(campaign.scheduledAt);
  const campaignStatusClass = getCampaignStatusClass(campaign.status);

  // Quick edit handler
  const handleQuickEditContact = (contactId: string, focus: any) => {
    setQuickEditContactId(contactId);
    setQuickEditFocus(focus);
  };

  const handleCloseQuickEdit = () => {
    setQuickEditContactId(null);
    setQuickEditFocus(null);
  };

  return (
    <Page className="pb-20">
      {/* Header with controls */}
      <CampaignHeader
        campaign={campaign}
        isRealtimeConnected={isRealtimeConnected}
        scheduledTimeDisplay={scheduledTimeDisplay}
        campaignStatusClass={campaignStatusClass}
        canStart={canStart}
        onStart={onStart}
        isStarting={isStarting}
        canCancelSchedule={canCancelSchedule}
        onCancelSchedule={onCancelSchedule}
        isCancelingSchedule={isCancelingSchedule}
        canCancelSend={canCancelSend}
        onCancelSend={onCancelSend}
        isCancelingSend={isCancelingSend}
        canPause={canPause}
        onPause={onPause}
        isPausing={isPausing}
        canResume={canResume}
        onResume={onResume}
        isResuming={isResuming}
        shouldShowRefreshButton={shouldShowRefreshButton}
        refetch={refetch}
        isRefreshing={isRefreshing}
        skippedCount={skippedCount}
        onResendSkipped={onResendSkipped}
        isResendingSkipped={isResendingSkipped}
        onShowTemplatePreview={() => setShowTemplatePreview(true)}
      />

      {/* Stats Grid */}
      <CampaignStatsGrid
        sentCount={sentCountForUi}
        deliveredTotal={deliveredTotalForUi}
        readCount={readCountForUi}
        skippedCount={skippedCount}
        failedCount={failedCountForUi}
        deliveredOnlyCount={deliveredOnlyCountForUi}
        recipients={campaign.recipients ?? 0}
        hasLiveStats={hasLiveStats}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        setIncludeReadInDelivered={setIncludeReadInDelivered}
        durationValue={durationValue}
        durationSubvalue={durationSubvalue}
        durationIsLive={durationIsLive}
      />

      {/* Flow/MiniApp Panel - exibido apenas se a campanha usa Flow */}
      <CampaignFlowPanel campaign={campaign} />

      {/* Performance Panel - Dev only */}
      {isDevMode && (
        <CampaignPerformancePanel
          isPerfOpen={isPerfOpen}
          setIsPerfOpen={setIsPerfOpen}
          perfSourceLabel={perfSourceLabel}
          metrics={metrics}
          perf={perf}
          throughputMpsForUi={throughputMpsForUi ?? 0}
          dispatchDurationMsForUi={dispatchDurationMsForUi ?? 0}
          isPerfEstimatedLive={isPerfEstimatedLive}
          baselineThroughputMedian={baselineThroughputMedian}
          limiterInfo={limiterInfo}
        />
      )}

      {/* Telemetry Panel (debug) - Dev only */}
      {isDevMode && telemetry && <CampaignTelemetryPanel telemetry={telemetry} />}

      {/* Trace Panel - Dev only */}
      {isDevMode && (
        <CampaignTracePanel campaignId={campaign.id} initialTraceId={(perf as any)?.trace_id || null} />
      )}

      {/* Message Log Table */}
      <MessageLogTable
        messages={messages}
        messageStats={messageStats}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterStatus={filterStatus}
        includeReadInDelivered={includeReadInDelivered}
        setIncludeReadInDelivered={setIncludeReadInDelivered}
        canLoadMore={canLoadMore}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
        onQuickEditContact={handleQuickEditContact}
      />

      {/* Modals */}
      <ContactQuickEditModal
        isOpen={!!quickEditContactId}
        contactId={quickEditContactId}
        onClose={handleCloseQuickEdit}
        focus={quickEditFocus}
        mode={quickEditFocus ? 'focused' : 'full'}
        title="Corrigir contato"
      />

      <TemplatePreviewModal
        isOpen={showTemplatePreview}
        onClose={() => setShowTemplatePreview(false)}
        templateName={campaign.templateName}
      />
    </Page>
  );
};

// Re-export types for consumers
export type { CampaignDetailsViewProps } from './details';
