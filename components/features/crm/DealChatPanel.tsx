'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Loader2, MessageCircle, Phone, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageBubble } from '@/components/features/inbox/MessageBubble'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { InboxMessage } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatData {
  conversationId: string | null
  phone: string | null
  contactName: string | null
  messages: InboxMessage[]
  hasMore: boolean
  noPhone?: boolean
}

interface Props {
  dealId: string
  contactPhone?: string | null
}

// ---------------------------------------------------------------------------
// Hook: fetch + send
// ---------------------------------------------------------------------------

function useDealChat(dealId: string) {
  const queryClient = useQueryClient()
  const CHAT_KEY = ['deal-chat', dealId]

  const query = useQuery<ChatData>({
    queryKey: CHAT_KEY,
    queryFn: async () => {
      const res = await fetch(`/api/crm/deals/${dealId}/chat`)
      if (!res.ok) throw new Error('Erro ao carregar conversa')
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 15_000, // polling a cada 15s
  })

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/crm/deals/${dealId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao enviar mensagem')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEY })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Falha ao enviar mensagem')
    },
  })

  return {
    ...query,
    sendMessage: sendMutation.mutate,
    isSending: sendMutation.isPending,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealChatPanel({ dealId }: Props) {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  const { data, isLoading, isFetching, sendMessage, isSending, refetch } = useDealChat(dealId)

  // Auto-scroll on new messages
  useEffect(() => {
    const msgs = data?.messages ?? []
    if (msgs.length > prevLenRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
    prevLenRef.current = msgs.length
  }, [data?.messages?.length])

  // Initial scroll
  useEffect(() => {
    if (data?.messages?.length) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'instant' })
    }
  }, [data?.conversationId])

  const handleSend = useCallback(() => {
    const content = text.trim()
    if (!content || isSending) return
    sendMessage(content)
    setText('')
  }, [text, isSending, sendMessage])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        <p className="text-xs text-zinc-500">Carregando conversa…</p>
      </div>
    )
  }

  // No phone on contact
  if (data?.noPhone || !data?.phone) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2 px-6 text-center">
        <Phone className="h-8 w-8 text-zinc-700" />
        <p className="text-sm text-zinc-400 font-medium">Sem telefone</p>
        <p className="text-xs text-zinc-600">
          Este deal não possui um contato com número de telefone. Adicione um telefone ao contato para
          iniciar uma conversa via WhatsApp.
        </p>
      </div>
    )
  }

  const messages = data?.messages ?? []

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-header: info do contato + refresh */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            {data?.contactName && (
              <p className="text-xs font-medium text-zinc-200 truncate">{data.contactName}</p>
            )}
            <p className="text-[11px] text-zinc-500">{data?.phone}</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded"
          title="Atualizar"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-2 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageCircle className="h-8 w-8 text-zinc-700" />
            <p className="text-xs text-zinc-500">Nenhuma mensagem ainda</p>
            <p className="text-[11px] text-zinc-600">Envie a primeira mensagem abaixo</p>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {messages.map((msg, idx) => {
              const prev = messages[idx - 1]
              const next = messages[idx + 1]
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isFirstInGroup={!prev || prev.direction !== msg.direction}
                  isLastInGroup={!next || next.direction !== msg.direction}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 px-2 py-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensagem WhatsApp…"
            rows={2}
            className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-100 text-xs resize-none focus-visible:ring-1 focus-visible:ring-emerald-500/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!text.trim() || isSending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 self-end h-9 w-9 p-0"
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1 pl-1">Ctrl+Enter para enviar</p>
      </div>
    </div>
  )
}
