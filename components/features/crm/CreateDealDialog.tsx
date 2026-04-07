'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { PipelineStage, CreateDealDTO } from '@/types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface CreateDealDialogProps {
    open: boolean
    stages: PipelineStage[]
    defaultStageId?: string
    onOpenChange: (open: boolean) => void
    onCreate: (dto: CreateDealDTO) => void
    isCreating?: boolean
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CreateDealDialog({
    open,
    stages,
    defaultStageId,
    onOpenChange,
    onCreate,
    isCreating,
}: CreateDealDialogProps) {
    const [title, setTitle] = useState('')
    const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id ?? '')
    const [value, setValue] = useState('')
    const [notes, setNotes] = useState('')

    // Atualiza stageId quando muda o default
    const effectiveStageId = stageId || defaultStageId || stages[0]?.id || ''

    function handleSubmit() {
        if (!title.trim() || !effectiveStageId) return
        onCreate({
            stageId: effectiveStageId,
            title: title.trim(),
            value: value ? Number(value) : 0,
            notes: notes.trim() || null,
        })
        // Limpa campos após criar
        setTitle('')
        setValue('')
        setNotes('')
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-sm">
                <DialogHeader>
                    <DialogTitle>Novo Deal</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    {/* Título */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">Título *</Label>
                        <Input
                            autoFocus
                            placeholder="Ex: Proposta para Empresa X"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            className="bg-zinc-800 border-zinc-700 text-zinc-100"
                        />
                    </div>

                    {/* Estágio */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">Estágio</Label>
                        <Select
                            value={effectiveStageId}
                            onValueChange={setStageId}
                        >
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                <SelectValue placeholder="Selecione…" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-700">
                                {stages.map((s) => (
                                    <SelectItem
                                        key={s.id}
                                        value={s.id}
                                        className="text-zinc-100 focus:bg-zinc-800"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: s.color }}
                                            />
                                            {s.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Valor */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">Valor (R$)</Label>
                        <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="bg-zinc-800 border-zinc-700 text-zinc-100"
                        />
                    </div>

                    {/* Notas */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">Notas (opcional)</Label>
                        <Textarea
                            placeholder="Observações sobre este lead…"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="bg-zinc-800 border-zinc-700 text-zinc-100 resize-none text-sm"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="border-zinc-700 text-zinc-400"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!title.trim() || !effectiveStageId || isCreating}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {isCreating ? 'Criando…' : 'Criar Deal'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
