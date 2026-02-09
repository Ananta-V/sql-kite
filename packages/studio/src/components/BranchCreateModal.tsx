'use client'

import { useState, useEffect } from 'react'
import { X, Loader, GitBranch } from 'lucide-react'
import { createBranch, getBranches } from '@/lib/api'

interface BranchCreateModalProps {
  isOpen: boolean
  onClose: () => void
  currentBranch: string
  onSuccess?: () => void
}

interface Branch {
  name: string
  is_current: boolean
}

export default function BranchCreateModal({
  isOpen,
  onClose,
  currentBranch,
  onSuccess
}: BranchCreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseBranch, setBaseBranch] = useState(currentBranch)
  const [branches, setBranches] = useState<Branch[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load available branches when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBranches()
      setBaseBranch(currentBranch) // Default to current branch
    }
  }, [isOpen, currentBranch])

  async function loadBranches() {
    setLoading(true)
    try {
      const data = await getBranches()
      setBranches(data.branches || [])
    } catch (err: any) {
      console.error('Failed to load branches:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  async function handleCreate() {
    if (!name.trim()) {
      setError('Branch name is required')
      return
    }

    // Validate branch name format
    if (!/^[a-zA-Z0-9_/-]+$/.test(name)) {
      setError('Branch name can only contain letters, numbers, hyphens, slashes, and underscores')
      return
    }

    if (!baseBranch) {
      setError('Base branch is required')
      return
    }

    setCreating(true)
    setError(null)

    try {
      await createBranch(name.trim(), baseBranch, description.trim() || undefined)

      // Reset form
      setName('')
      setDescription('')
      setBaseBranch(currentBranch)

      onClose()
      onSuccess?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function handleClose() {
    if (creating) return
    setName('')
    setDescription('')
    setBaseBranch(currentBranch)
    setError(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-app-accent" />
            <h2 className="text-xl font-bold">Create New Branch</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={creating}
            className="text-app-text-dim hover:text-app-text transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Branch Name */}
          <div>
            <label className="block text-sm text-app-text-dim mb-2">
              Branch Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) {
                  handleCreate()
                }
              }}
              placeholder="e.g., feature/auth or experiment"
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
              autoFocus
              disabled={creating}
            />
            <p className="text-xs text-app-text-dim mt-1">
              Letters, numbers, hyphens, slashes, and underscores only
            </p>
          </div>

          {/* Base Branch Selection */}
          <div>
            <label className="block text-sm text-app-text-dim mb-2">
              Base Branch <span className="text-red-400">*</span>
            </label>
            <select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              disabled={creating || loading}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent cursor-pointer"
            >
              {loading ? (
                <option>Loading branches...</option>
              ) : (
                branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} {branch.is_current ? '(current)' : ''}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-app-text-dim mt-1">
              The branch to copy from
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-app-text-dim mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this branch for?"
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent resize-none"
              rows={3}
              disabled={creating}
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
            <p className="text-xs text-blue-400">
              ℹ️ This will create a full isolated copy of <span className="font-semibold">{baseBranch}</span>
            </p>
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
              disabled={creating}
              className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !baseBranch || loading}
              className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors flex items-center gap-2"
            >
              {creating ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Branch</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
