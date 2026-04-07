'use client'

import { useState, useEffect } from 'react'
import {
    X,
    Pencil,
    Trophy,
    XCircle,
    Play,
    StopCircle,
    Clock,
    User,
    Phone,
    DollarSign,
    StickyNote,
    Send,
    Trash2,
    CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useDealActivities } from '@/hooks/useCRM'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dealService } from '@/services/crmService'
import { toast } from 'sonner'
import { CRM_KEYS } from '@/hooks/useCRM'
import type { Deal, DealActivity, DealActivityType, UpdateDealDTO } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch {
        return iso
    }
}

function formatNextAction(nextActionAt: string | null): string | null {
    if (!nextActionAt) return null
    const diff = new Date(nextActionAt).getTime() - Date.now()
    const overdue = diff < 0
    const abs = Math.abs(diff)
    const hours = Math.floor(abs / 3_600_000)
    const mins = Math.floor((abs % 3_600_000) / 60_000)
    const label = hours >= 48
        ? `${Math.floor(hours / 24)}d`
        : hours > 0
            ? `${hours}h`
            : `${mins}min`
    return overdue ? `Atrasado ${label}` : `Próximo disparo em ${label}`
}

const ACTIVITY_ICONS: Record<DealActivityType, React.ReactNode> = {
    note: <StickyNote className="h-3.5 w-3.5 text-zinc-400" />,
    call: <Phone className="h-3.5 w-3.5 text-blue-400" />,
    whatsapp_sent: <Send className="h-3.5 w-3.5 text-emerald-400" />,
    whatsapp_read: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />,
    stage_change: <Trophy className="h-3.5 w-3.5 text-yellow-400" />,
    system: <Clock className="h-3.5 w-3.5 text-zinc-500" />,
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface DealDetailPanelProps {
    deal: Deal | null
    onClose: () => void
    onUpdate: (id: string, dto: UpdateDealDTO) => void
    onMarkWon: (id: string) => void
    onMarkLost: (id: string) => void
    onDelete: (id: string) => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function DealDetailPanel({
    deal,
    onClose,
    onUpdate,
    onMarkWon,
    onMarkLost,
    onDelete,
}: DealDetailPanelProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [titleInput, setTitleInput] = useState('')
    const [valueInput, setValueInput] = useState('')
    const [notesInput, setNotesInput] = useState('')
    const [noteText, setNoteText] = useState('')
    const queryClient = useQueryClient()

    const { activities, isLoading: activitiesLoading, addNote, isAddingNote } = useDealActivities(
        deal?.id ?? null
    )

    // Inicializa campos ao abrir deal
    useEffect(() => {
        if (deal) {
            setTitleInput(deal.title)
            setValueInput(deal.value > 0 ? String(deal.value) : '')
            setNotesInput(deal.notes ?? '')
            setIsEditingTitle(false)
        }
    }, [deal?.id])

    // Funnel start/stop mutations
    const startFunnelMutation = useMutation({
        mutationFn: async (dealId: string) => {
            const res = await fetch('/api/crm/funnel/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealId, restartIfActive: true }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err?.error || 'Falha ao iniciar funil')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
            toast.success('Funil iniciado')
        },
        onError: (err: any) => toast.error(err?.message || 'Falha ao iniciar funil'),
    })

    const stopFunnelMutation = useMutation({
        mutationFn: async (dealId: string) => {
            const res = await fetch('/api/crm/funnel/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealId, reason: 'Parado manualmente pelo usuário' }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err?.error || 'Falha ao parar funil')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CRM_KEYS.allDeals })
            toast.success('Funil parado')
        },
        onError: (err: any) => toast.error(err?.message || 'Falha ao parar funil'),
    })

    if (!deal) return null

    function saveField(field: 'title' | 'value' | 'notes') {
        if (!deal) return
        if (field === 'title' && !titleInput.trim()) return
        const dto: UpdateDealDTO = {}
        if (field === 'title') dto.title = titleInput.trim()
        if (field === 'value') dto.value = Number(valueInput) || 0
        if (field === 'notes') dto.notes = notesInput.trim() || null
        onUpdate(deal.id, dto)
        if (field === 'title') setIsEditingTitle(false)
    }

    function handleAddNote() {
        if (!noteText.trim()) return
        addNote(noteText.trim())
        setNoteText('')
    }

    const hasFunnel = !!(deal.qstashMessageId || deal.nextActionAt)
    const nextActionLabel = formatNextAction(deal.nextActionAt)

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-700 overflow-hidden">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-zinc-800">
                <div className="flex-1 min-w-0">
                    {isEditingTitle ? (
                        <Input
                            autoFocus
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            onBlur={() => saveField('title')}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') saveField('title')
                                if (e.key === 'Escape') setIsEditingTitle(false)
                            }}
                            className="bg-zinc-800 border-zinc-600 text-zinc-100 text-sm font-medium"
                        />
                    ) : (
                        <button
                            onClick={() => setIsEditingTitle(true)}
                            className="flex items-center gap-1.5 group text-left w-full"
                        >
                            <h2 className="text-sm font-semibold text-zinc-100 line-clamp-2">
                                {deal.title}
                            </h2>
                            <Pencil className="h-3 w-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                        </button>
                    )}

                    {/* Status badges */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {deal.status === 'won' && (
                            <Badge className="bg-emerald-900/50 text-emerald-400 text-xs">
                                Ganho
                            </Badge>
                        )}
                        {deal.status === 'lost' && (
                            <Badge className="bg-red-900/50 text-red-400 text-xs">
                                Perdido
                            </Badge>
                        )}
                        {deal.status === 'open' && nextActionLabel && (
                            <Badge
                                className={cn(
                                    'text-xs',
                                    deal.nextActionAt && new Date(deal.nextActionAt) < new Date()
                                        ? 'bg-red-900/50 text-red-400'
                                        : 'bg-zinc-800 text-zinc-400'
                                )}
                            >
                                <Clock className="h-3 w-3 mr-1" />
                                {nextActionLabel}
                            </Badge>
                        )}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors mt-0.5"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Contato */}
                {deal.contact && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <User className="h-4 w-4 shrink-0" />
                        <span>{deal.contact.name}</span>
                        <span className="text-zinc-600">·</span>
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{deal.contact.phone}</span>
                    </div>
                )}

                {/* Valor */}
                <div className="space-y-1">
                    <Label className="text-xs text-zinc-500 flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        Valor (R$)
                    </Label>
                    <Input
                        type="number"
                        min={0}
                        value={valueInput}
                        onChange={(e) => setValueInput(e.target.value)}
                        onBlur={() => saveField('value')}
                        onKeyDown={(e) => e.key === 'Enter' && saveField('value')}
                        placeholder="0"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm"
                    />
                </div>

                {/* Notas */}
                <div className="space-y-1">
                    <Label className="text-xs text-zinc-500 flex items-center gap-1">
                        <StickyNote className="h-3.5 w-3.5" />
                        Notas
                    </Label>
                    <Textarea
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        onBlur={() => saveField('notes')}
                        rows={3}
                        placeholder="Observações sobre este lead…"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm resize-none"
                    />
                </div>

                {/* Ações: ganho / perdido / funil */}
                {deal.status === 'open' && (
                    <>
                        <Separator className="bg-zinc-800" />
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
                                Ações
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => onMarkWon(deal.id)}
                                    className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs"
                                >
                                    <Trophy className="h-3.5 w-3.5 mr-1.5" />
                                    Marcar como Ganho
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onMarkLost(deal.id)}
                                    className="border-red-800 text-red-400 hover:bg-red-900/30 text-xs"
                                >
                                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                    Marcar como Perdido
                                </Button>
                            </div>

                            {/* Funil */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startFunnelMutation.mutate(deal.id)}
                                    disabled={startFunnelMutation.isPending}
                                    className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 text-xs"
                                >
                                    <Play className="h-3.5 w-3.5 mr-1.5" />
                                    {hasFunnel ? 'Reiniciar Funil' : 'Iniciar Funil'}
                                </Button>
                                {hasFunnel && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => stopFunnelMutation.mutate(deal.id)}
                                        disabled={stopFunnelMutation.isPending}
                                        className="border-zinc-700 text-zinc-500 hover:text-zinc-300 text-xs"
                                    >
                                        <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                                        Parar Funil
                                    </Button>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Timeline de atividades */}
                <Separator className="bg-zinc-800" />
                <div className="space-y-3">
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
                        Histórico
                    </p>

                    {/* Adicionar nota */}
                    <div className="flex gap-2">
                        <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Escreva uma nota…"
                            rows={2}
                            className="bg-zinc-800 border-zinc-700 text-zinc-100 text-xs resize-none flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault()
                                    handleAddNote()
                                }
                            }}
                        />
                        <Button
                            size="sm"
                            onClick={handleAddNote}
                            disabled={!noteText.trim() || isAddingNote}
                            className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 shrink-0 self-end"
                        >
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Lista de atividades */}
                    {activitiesLoading ? (
                        <p className="text-xs text-zinc-600">Carregando histórico…</p>
                    ) : activities.length === 0 ? (
                        <p className="text-xs text-zinc-600">Nenhuma atividade registrada.</p>
                    ) : (
                        <div className="space-y-2">
                            {activities.map((act) => (
                                <ActivityItem key={act.id} activity={act} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer: deletar */}
            <div className="px-4 py-3 border-t border-zinc-800">
                <button
                    onClick={() => {
                        if (confirm('Remover este deal permanentemente?')) {
                            onDelete(deal.id)
                            onClose()
                        }
                    }}
                    className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-red-400 transition-colors"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover deal
                </button>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// ActivityItem
// ---------------------------------------------------------------------------

function ActivityItem({ activity }: { activity: DealActivity }) {
    return (
        <div className="flex gap-2.5">
            <div className="shrink-0 mt-0.5">
                {ACTIVITY_ICONS[activity.type] ?? <Clock className="h-3.5 w-3.5 text-zinc-600" />}
            </div>
            <div className="flex-1 min-w-0">
                {activity.body && (
                    <p className="text-xs text-zinc-300 leading-relaxed">{activity.body}</p>
                )}
                <p className="text-[11px] text-zinc-600 mt-0.5">{formatDate(activity.createdAt)}</p>
            </div>
        </div>
    )
}
