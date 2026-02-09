'use client'

import { useState } from 'react'
import { X, Loader, ArrowRight, AlertTriangle } from 'lucide-react'
import { promoteBranch } from '@/lib/api'

interface BranchPromoteModalProps {
  isOpen: boolean
  onClose: () => void
  sourceBranch: string
  branches: string[]
  onSuccess?: () => void
}

export default function BranchPromoteModal({
  isOpen,
  onClose,
  sourceBranch,
  branches,
  onSuccess
}: BranchPromoteModalProps) {
  const [targetBranch, setTargetBranch] = useState('main')
  const [createSnapshot, setCreateSnapshot] = useState(true)
  const [promoting, setPromoting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  // Filter out the source branch from target options
  const targetOptions = branches.filter(b => b !== sourceBranch)

  async function handlePromote() {
    if (!targetBranch) {
      setError('Target branch is required')
      return
    }

    if (targetBranch === sourceBranch) {
      setError('Cannot promote to the same branch')
      return
    }

    if (!confirm(`Are you sure you want to promote "${sourceBranch}" to "${targetBranch}"?\n\n⚠️ This will replace the entire state of "${targetBranch}" with "${sourceBranch}".`)) {
      return
    }

    setPromoting(true)
    setError(null)

    try {
      await promoteBranch(sourceBranch, targetBranch, createSnapshot)
      onClose()
      onSuccess?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPromoting(false)
    }
  }

  function handleClose() {
    if (promoting) return
    setError(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Promote Branch</h2>
          <button
            onClick={handleClose}
            disabled={promoting}
            className="text-app-text-dim hover:text-app-text transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Source Branch */}
          <div>
            <label className="block text-sm text-app-text-dim mb-2">
              Source
            </label>
            <div className="px-3 py-2 bg-app-bg border border-app-border rounded font-mono text-app-accent">
              {sourceBranch}
            </div>
          </div>

          {/* Arrow Icon */}
          <div className="flex justify-center">
            <ArrowRight className="w-6 h-6 text-app-text-dim" />
          </div>

          {/* Target Branch */}
          <div>
            <label className="block text-sm text-app-text-dim mb-2">
              Target <span className="text-red-400">*</span>
            </label>
            <select
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              disabled={promoting}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent cursor-pointer"
            >
              {targetOptions.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
            {targetBranch === 'main' && (
              <div className="mt-2 flex items-start gap-2 text-yellow-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">main</span> is a protected branch.
                  This operation will update production state.
                </div>
              </div>
            )}
            {targetBranch !== 'main' && (
              <p className="text-xs text-app-text-dim mt-1">
                The branch that will be updated
              </p>
            )}
          </div>

          {/* Promotion Method */}
          <div>
            <label className="block text-sm text-app-text-dim mb-2">
              Promotion Method
            </label>
            <div className="px-3 py-2.5 bg-app-bg border border-app-border rounded">
              <div className="flex items-start gap-2">
                <div className="text-green-400 mt-0.5">✓</div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Full state replacement (SQLite-safe)</div>
                  <div className="text-xs text-app-text-dim mt-1">
                    SQLite branches are promoted by replacing the target database state.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Snapshot Option */}
          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createSnapshot}
                onChange={(e) => setCreateSnapshot(e.target.checked)}
                disabled={promoting}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Create snapshot before promote</div>
                <div className="text-xs text-app-text-dim">Recommended for easy rollback</div>
              </div>
            </label>
          </div>

          {/* Summary Box */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1 text-sm text-yellow-200">
                <p className="font-medium">Summary:</p>
                <ul className="space-y-1 list-disc list-inside text-xs">
                  <li><span className="font-mono">{targetBranch}</span> will be updated to match <span className="font-mono">{sourceBranch}</span></li>
                  <li><span className="font-mono">{targetBranch}</span> history will be preserved in timeline</li>
                  <li><span className="font-mono">{sourceBranch}</span> will remain unchanged</li>
                  {createSnapshot && <li>Automatic snapshot created for rollback</li>}
                </ul>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              disabled={promoting}
              className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePromote}
              disabled={promoting || !targetBranch}
              className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors flex items-center gap-2"
            >
              {promoting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Promoting...</span>
                </>
              ) : (
                <span>Promote</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
