'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Copy, Star, ArrowLeft, GitBranch, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Page, PageHeader, PageTitle, PageDescription } from '@/components/ui/page'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useFunnels } from '@/hooks/useFunnels'
import type { Funnel } from '@/types'

export default function FunnelsPage() {
    const {
        funnels, isLoading,
        createFunnel, updateFunnel, deleteFunnel, duplicateFunnel, setDefault,
        isCreating, isUpdating, isDeleting,
    } = useFunnels()

    // Dialogs
    const [createOpen, setCreateOpen] = useState(false)
    const [editFunnel, setEditFunnel] = useState<Funnel | null>(null)
    const [deleteFunnelTarget, setDeleteFunnelTarget] = useState<Funnel | null>(null)
    const [duplicateFunnelTarget, setDuplicateFunnelTarget] = useState<Funnel | null>(null)

    // Form states
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [editName, setEditName] = useState('')
    const [dupName, setDupName] = useState('')

    const handleCreate = async () => {
        if (!newName.trim()) return
        try {
            await createFunnel({ name: newName.trim(), description: newDesc.trim() || null })
            toast.success('Funil criado!')
            setCreateOpen(false)
            setNewName('')
            setNewDesc('')
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleEdit = async () => {
        if (!editFunnel || !editName.trim()) return
        try {
            await updateFunnel(editFunnel.id, { name: editName.trim() })
            toast.success('Funil atualizado!')
            setEditFunnel(null)
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleDelete = async () => {
        if (!deleteFunnelTarget) return
        try {
            await deleteFunnel(deleteFunnelTarget.id)
            toast.success('Funil removido!')
            setDeleteFunnelTarget(null)
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleDuplicate = async () => {
        if (!duplicateFunnelTarget || !dupName.trim()) return
        try {
            await duplicateFunnel(duplicateFunnelTarget.id, dupName.trim())
            toast.success('Funil duplicado!')
            setDuplicateFunnelTarget(null)
            setDupName('')
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleToggleActive = async (funnel: Funnel) => {
        try {
            await updateFunnel(funnel.id, { isActive: !funnel.isActive })
            toast.success(funnel.isActive ? 'Funil desativado' : 'Funil ativado')
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const handleSetDefault = async (funnel: Funnel) => {
        if (funnel.isDefault) return
        try {
            await setDefault(funnel.id)
            toast.success(`"${funnel.name}" definido como funil padrão`)
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    return (
        <Page>
            <PageHeader>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <Link href="/crm">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <PageTitle>Gerenciar Funis</PageTitle>
                        <PageDescription>
                            Crie funis independentes: vendas, pós-venda, reativação e mais.
                        </PageDescription>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Novo Funil
                </Button>
            </PageHeader>

            {/* Lista de funis */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 rounded-xl bg-zinc-800/50 animate-pulse" />
                    ))}
                </div>
            ) : funnels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                    <GitBranch className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">Nenhum funil ainda.</p>
                    <Button
                        variant="link"
                        className="text-emerald-400 mt-1"
                        onClick={() => setCreateOpen(true)}
                    >
                        Criar primeiro funil
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {funnels.map((funnel) => (
                        <div
                            key={funnel.id}
                            className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                            <GitBranch className="h-5 w-5 text-zinc-500 shrink-0" />

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-zinc-100 truncate">{funnel.name}</span>
                                    {funnel.isDefault && (
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded shrink-0">
                                            padrão
                                        </span>
                                    )}
                                    {!funnel.isActive && (
                                        <span className="text-[10px] bg-zinc-700/50 text-zinc-500 px-1.5 py-0.5 rounded shrink-0">
                                            inativo
                                        </span>
                                    )}
                                </div>
                                {funnel.description && (
                                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{funnel.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-600">
                                    <span>{funnel.stageCount ?? 0} estágios</span>
                                    <span>{funnel.openDealsCount ?? 0} deals abertos</span>
                                </div>
                            </div>

                            {/* Ações */}
                            <div className="flex items-center gap-1 shrink-0">
                                {/* Definir como padrão */}
                                <button
                                    onClick={() => handleSetDefault(funnel)}
                                    disabled={funnel.isDefault}
                                    title={funnel.isDefault ? 'Já é o funil padrão' : 'Definir como padrão'}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Star className="h-4 w-4" fill={funnel.isDefault ? 'currentColor' : 'none'} />
                                </button>

                                {/* Toggle ativo */}
                                <button
                                    onClick={() => handleToggleActive(funnel)}
                                    title={funnel.isActive ? 'Desativar' : 'Ativar'}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                                >
                                    {funnel.isActive
                                        ? <ToggleRight className="h-4 w-4 text-emerald-400" />
                                        : <ToggleLeft className="h-4 w-4" />
                                    }
                                </button>

                                {/* Editar */}
                                <button
                                    onClick={() => { setEditFunnel(funnel); setEditName(funnel.name) }}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>

                                {/* Duplicar */}
                                <button
                                    onClick={() => { setDuplicateFunnelTarget(funnel); setDupName(`${funnel.name} (cópia)`) }}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>

                                {/* Remover */}
                                <button
                                    onClick={() => setDeleteFunnelTarget(funnel)}
                                    disabled={funnel.isDefault}
                                    title={funnel.isDefault ? 'Não é possível remover o funil padrão' : 'Remover'}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Dialog — Criar funil */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Funil</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Input
                            placeholder="Nome do funil (ex: Pós-venda)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            autoFocus
                        />
                        <Input
                            placeholder="Descrição (opcional)"
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!newName.trim() || isCreating}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isCreating ? 'Criando…' : 'Criar Funil'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog — Editar funil */}
            <Dialog open={!!editFunnel} onOpenChange={(o) => !o && setEditFunnel(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Funil</DialogTitle>
                    </DialogHeader>
                    <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                        autoFocus
                        className="my-2"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditFunnel(null)}>Cancelar</Button>
                        <Button
                            onClick={handleEdit}
                            disabled={!editName.trim() || isUpdating}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isUpdating ? 'Salvando…' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog — Duplicar funil */}
            <Dialog open={!!duplicateFunnelTarget} onOpenChange={(o) => !o && setDuplicateFunnelTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Duplicar "{duplicateFunnelTarget?.name}"</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-zinc-400 mb-2">
                        Será criado um novo funil com os mesmos estágios (sem os deals).
                    </p>
                    <Input
                        placeholder="Nome do novo funil"
                        value={dupName}
                        onChange={(e) => setDupName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDuplicate()}
                        autoFocus
                    />
                    <DialogFooter className="mt-3">
                        <Button variant="outline" onClick={() => setDuplicateFunnelTarget(null)}>Cancelar</Button>
                        <Button
                            onClick={handleDuplicate}
                            disabled={!dupName.trim()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            Duplicar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AlertDialog — Confirmar remoção */}
            <AlertDialog open={!!deleteFunnelTarget} onOpenChange={(o) => !o && setDeleteFunnelTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover funil?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O funil <strong>"{deleteFunnelTarget?.name}"</strong> e todos os seus estágios serão removidos permanentemente.
                            Os deals vinculados precisam ser movidos antes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? 'Removendo…' : 'Remover'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Page>
    )
}
