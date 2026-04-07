'use client'

import { useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Page, PageDescription, PageHeader, PageTitle } from '@/components/ui/page'
import { StageConfigPanel } from '@/components/features/crm/StageConfigPanel'
import { useCRMStages } from '@/hooks/useCRMStages'
import type { FunnelStageConfig } from '@/types'

// ---------------------------------------------------------------------------
// Paleta de cores rápida para criação de estágio
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
    '#6366f1', '#f59e0b', '#3b82f6', '#8b5cf6',
    '#10b981', '#ef4444', '#ec4899', '#14b8a6',
]

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function CRMPage() {
    const {
        stages,
        isLoading,
        refetch,
        createStage,
        saveFunnelConfig,
        deleteStage,
        isSaving,
        isDeleting,
    } = useCRMStages()

    // Estado do modal de criação
    const [showCreate, setShowCreate] = useState(false)
    const [newStageName, setNewStageName] = useState('')
    const [newStageColor, setNewStageColor] = useState(PRESET_COLORS[0])

    // Estado do confirm de deleção
    const [stageToDelete, setStageToDelete] = useState<string | null>(null)

    function handleCreate() {
        if (!newStageName.trim()) return
        createStage({ name: newStageName.trim(), color: newStageColor })
        setNewStageName('')
        setNewStageColor(PRESET_COLORS[0])
        setShowCreate(false)
    }

    function handleSaveFunnelConfig(stageId: string, config: FunnelStageConfig) {
        saveFunnelConfig(stageId, config)
    }

    return (
        <Page>
            <PageHeader>
                <div>
                    <PageTitle>Funil de Vendas — Configuração</PageTitle>
                    <PageDescription>
                        Configure o template WhatsApp, delay e ação ao responder para cada estágio do funil automático.
                    </PageDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
                    >
                        <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setShowCreate(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Novo estágio
                    </Button>
                </div>
            </PageHeader>

            {/* Conteúdo */}
            <div className="max-w-2xl space-y-3">
                {isLoading && (
                    <div className="py-12 text-center text-zinc-500 text-sm">
                        Carregando estágios…
                    </div>
                )}

                {!isLoading && stages.length === 0 && (
                    <div className="py-12 text-center space-y-3">
                        <p className="text-zinc-400 text-sm">Nenhum estágio configurado.</p>
                        <Button
                            size="sm"
                            onClick={() => setShowCreate(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Plus className="h-4 w-4 mr-1.5" />
                            Criar primeiro estágio
                        </Button>
                    </div>
                )}

                {stages.map((stage) => (
                    <div key={stage.id} className="relative group">
                        <StageConfigPanel
                            stage={stage}
                            onSave={handleSaveFunnelConfig}
                            isSaving={isSaving}
                        />
                        {/* Botão de deletar (aparece no hover) */}
                        <button
                            onClick={() => setStageToDelete(stage.id)}
                            className="absolute top-3 right-10 hidden group-hover:flex items-center justify-center h-6 w-6 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                            title="Remover estágio"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal: criar estágio */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Novo estágio</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Nome do estágio</Label>
                            <Input
                                autoFocus
                                placeholder="Ex: Em negociação"
                                value={newStageName}
                                onChange={(e) => setNewStageName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                className="bg-zinc-800 border-zinc-700 text-zinc-100"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Cor</Label>
                            <div className="flex gap-2 flex-wrap">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setNewStageColor(color)}
                                        className="h-7 w-7 rounded-full border-2 transition-all"
                                        style={{
                                            backgroundColor: color,
                                            borderColor:
                                                newStageColor === color ? '#fff' : 'transparent',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreate(false)}
                            className="border-zinc-700 text-zinc-400"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!newStageName.trim() || isSaving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            Criar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AlertDialog: confirmar deleção */}
            <AlertDialog
                open={!!stageToDelete}
                onOpenChange={(open) => !open && setStageToDelete(null)}
            >
                <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover estágio?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Esta ação não pode ser desfeita. Estágios com deals vinculados não podem ser removidos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-zinc-700 text-zinc-400 bg-transparent hover:bg-zinc-800">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (stageToDelete) {
                                    deleteStage(stageToDelete)
                                    setStageToDelete(null)
                                }
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Page>
    )
}
