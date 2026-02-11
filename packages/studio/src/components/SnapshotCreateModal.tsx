'use client'

import { useState } from 'react'
import { X, Camera, Loader } from 'lucide-react'
import { createSnapshot } from '@/lib/api'
import { format } from 'date-fns'

type SnapshotType = 'manual' | 'auto-before-migration' | 'auto-before-promote' | 'import-baseline' | 'auto-risky-query'

interface SnapshotCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  defaultType?: SnapshotType
  defaultLabel?: string
  defaultDescription?: string
}

export default function SnapshotCreateModal({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'manual',
  defaultLabel = '',
  defaultDescription = ''
}: SnapshotCreateModalProps) {
  const [label, setLabel] = useState(defaultLabel)
  const [description, setDescription] = useState(defaultDescription)
  const [type, setType] = useState<SnapshotType>(defaultType)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const generateDefaultLabel = () => {
    const now = new Date()
    return `Manual Snapshot – ${format(now, 'MMM d, HH:mm')}`
  }

  async function handleCreate() {
    const snapshotLabel = label.trim() || generateDefaultLabel()
    
    setCreating(true)
    setError(null)
    
    try {
      await createSnapshot({
        name: snapshotLabel,
        description: description.trim() || undefined,
        type
      })
      
      // Reset form
      setLabel('')
      setDescription('')
      setType('manual')
      
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create snapshot')
    } finally {
      setCreating(false)
    }
  }

  function handleClose() {
    if (creating) return
    setLabel('')
    setDescription('')
    setType('manual')
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={handleClose}
      />
      
      <div className="relative bg-app-bg border border-app-border rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Camera className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold">Create Snapshot</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={creating}
            className="p-2 hover:bg-app-sidebar-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={generateDefaultLabel()}
              className="w-full px-3 py-2.5 bg-app-sidebar border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-app-accent/50 text-sm"
              autoFocus
              disabled={creating}
            />
            <p className="text-xs text-app-text-dim mt-1.5">
              Give this moment a meaningful name
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-app-text-dim font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Safety checkpoint before major schema change"
              rows={2}
              className="w-full px-3 py-2.5 bg-app-sidebar border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-app-accent/50 text-sm resize-none"
              disabled={creating}
            />
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-app-sidebar border border-app-border rounded-lg cursor-pointer hover:border-app-accent/50 transition-colors">
                <input
                  type="radio"
                  name="snapshotType"
                  value="manual"
                  checked={type === 'manual'}
                  onChange={() => setType('manual')}
                  className="w-4 h-4 accent-app-accent"
                  disabled={creating}
                />
                <div>
                  <div className="text-sm font-medium">Manual</div>
                  <div className="text-xs text-app-text-dim">User created snapshot</div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-app-sidebar border border-app-border rounded-lg cursor-pointer hover:border-app-accent/50 transition-colors">
                <input
                  type="radio"
                  name="snapshotType"
                  value="auto-before-migration"
                  checked={type === 'auto-before-migration'}
                  onChange={() => setType('auto-before-migration')}
                  className="w-4 h-4 accent-app-accent"
                  disabled={creating}
                />
                <div>
                  <div className="text-sm font-medium">Before Migration</div>
                  <div className="text-xs text-app-text-dim">Checkpoint before applying migrations</div>
                </div>
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-app-border bg-app-sidebar/30">
          <button
            onClick={handleClose}
            disabled={creating}
            className="px-4 py-2 text-sm text-app-text-dim hover:text-app-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {creating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Create Snapshot
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
