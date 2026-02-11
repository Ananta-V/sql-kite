'use client'

import { useEffect, useState } from 'react'
import { Camera, Plus, RotateCcw, Trash2, ChevronDown, ChevronRight, Clock, Database, GitBranch, FileCode, Loader } from 'lucide-react'
import { getSnapshots, restoreSnapshot, deleteSnapshot } from '@/lib/api'
import { formatDistanceToNow, format } from 'date-fns'
import { useAppContext } from '@/contexts/AppContext'
import SnapshotCreateModal from './SnapshotCreateModal'

interface Snapshot {
  id: number
  branch: string
  filename: string
  name: string
  description?: string
  type: 'manual' | 'auto-before-migration' | 'auto-before-promote' | 'import-baseline' | 'auto-risky-query'
  size: number
  createdAt: string
  exists: boolean
}

const typeLabels: Record<string, string> = {
  'manual': 'Manual',
  'auto-before-migration': 'Before migration',
  'auto-before-promote': 'Before promote',
  'import-baseline': 'Import baseline',
  'auto-risky-query': 'Before risky query'
}

const typeColors: Record<string, string> = {
  'manual': 'text-blue-400',
  'auto-before-migration': 'text-amber-400',
  'auto-before-promote': 'text-purple-400',
  'import-baseline': 'text-green-400',
  'auto-risky-query': 'text-red-400'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function SnapshotsPage() {
  const { branchVersion } = useAppContext()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    loadSnapshots()
  }, [branchVersion])

  async function loadSnapshots() {
    try {
      setLoading(true)
      const data = await getSnapshots()
      setSnapshots(data)
    } catch (error) {
      console.error('Failed to load snapshots:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(snapshot: Snapshot) {
    if (!confirm(`Restore from "${snapshot.name}"?\n\nThis will replace your current database with this snapshot and restart the server.`)) {
      return
    }

    setRestoring(snapshot.id)
    try {
      await restoreSnapshot(snapshot.id)
      alert('Snapshot restored! The page will reload.')
      window.location.reload()
    } catch (error: any) {
      alert('Failed to restore snapshot: ' + error.message)
    } finally {
      setRestoring(null)
    }
  }

  async function handleDelete(snapshot: Snapshot) {
    if (!confirm(`Delete snapshot "${snapshot.name}"?\n\nThis action cannot be undone.`)) {
      return
    }

    setDeleting(snapshot.id)
    try {
      await deleteSnapshot(snapshot.id)
      await loadSnapshots()
      if (expandedId === snapshot.id) {
        setExpandedId(null)
      }
    } catch (error: any) {
      alert('Failed to delete snapshot: ' + error.message)
    } finally {
      setDeleting(null)
    }
  }

  function toggleExpand(id: number) {
    setExpandedId(expandedId === id ? null : id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-app-text-dim">
          <Loader className="w-5 h-5 animate-spin" />
          Loading snapshots...
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Snapshots</h1>
          <p className="text-app-text-dim text-sm mt-1">Restore points for your database</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Snapshot
        </button>
      </div>

      {/* Empty State */}
      {snapshots.length === 0 ? (
        <div className="bg-app-sidebar border border-app-border rounded-xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-app-bg rounded-full mb-4">
            <Camera className="w-8 h-8 text-app-text-dim opacity-50" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No snapshots yet</h3>
          <p className="text-app-text-dim mb-6 max-w-sm mx-auto">
            Create your first snapshot to save a restore point for your database.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-app-accent hover:bg-app-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            <Camera className="w-4 h-4" />
            Create Your First Snapshot
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot) => {
            const isExpanded = expandedId === snapshot.id
            const isProcessing = restoring === snapshot.id || deleting === snapshot.id
            
            return (
              <div
                key={snapshot.id}
                className={`bg-app-sidebar border rounded-xl transition-all ${
                  isExpanded ? 'border-app-accent/50 shadow-lg' : 'border-app-border hover:border-app-border-hover'
                }`}
              >
                {/* Collapsed View */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpand(snapshot.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button className="mt-0.5 p-1 -ml-1 hover:bg-app-bg rounded transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-app-text-dim" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-app-text-dim" />
                        )}
                      </button>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base truncate">
                          {snapshot.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-app-text-dim">
                          <span className="flex items-center gap-1">
                            <GitBranch className="w-3.5 h-3.5" />
                            {snapshot.branch}
                          </span>
                          <span>•</span>
                          <span>{formatSize(snapshot.size)}</span>
                          {snapshot.type !== 'manual' && (
                            <>
                              <span>•</span>
                              <span className={typeColors[snapshot.type] || 'text-app-text-dim'}>
                                {typeLabels[snapshot.type] || snapshot.type}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-app-text-dim">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(snapshot.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRestore(snapshot)
                      }}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {restoring === snapshot.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Restore
                    </button>
                  </div>
                </div>

                {/* Expanded View */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-app-border/50">
                    <div className="pt-4 space-y-4">
                      {/* Description */}
                      {snapshot.description && (
                        <div>
                          <div className="text-xs font-medium text-app-text-dim uppercase tracking-wider mb-1">
                            Description
                          </div>
                          <p className="text-sm text-app-text">
                            {snapshot.description}
                          </p>
                        </div>
                      )}

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-app-text-dim uppercase tracking-wider mb-1">
                            Branch
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <GitBranch className="w-3.5 h-3.5 text-app-text-dim" />
                            {snapshot.branch}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-app-text-dim uppercase tracking-wider mb-1">
                            Created
                          </div>
                          <div className="text-sm">
                            {format(new Date(snapshot.createdAt), 'MMM d, yyyy – HH:mm:ss')}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-app-text-dim uppercase tracking-wider mb-1">
                            Size
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Database className="w-3.5 h-3.5 text-app-text-dim" />
                            {formatSize(snapshot.size)}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-app-text-dim uppercase tracking-wider mb-1">
                            Type
                          </div>
                          <div className={`text-sm ${typeColors[snapshot.type] || 'text-app-text'}`}>
                            {typeLabels[snapshot.type] || 'Manual snapshot'}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-app-text-dim uppercase tracking-wider mb-1">
                            ID
                          </div>
                          <div className="text-sm font-mono text-app-text-dim">
                            {snapshot.id}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-app-text-dim uppercase tracking-wider mb-1">
                            Filename
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <FileCode className="w-3.5 h-3.5 text-app-text-dim flex-shrink-0" />
                            <span className="font-mono text-app-text-dim truncate text-xs">
                              {snapshot.filename}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() => handleRestore(snapshot)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {restoring === snapshot.id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          Restore
                        </button>

                        <button
                          onClick={() => handleDelete(snapshot)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {deleting === snapshot.id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <SnapshotCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadSnapshots}
      />
    </div>
  )
}