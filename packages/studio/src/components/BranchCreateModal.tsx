'use client'

import { useState, useEffect } from 'react'
import { X, Loader, GitBranch, Check } from 'lucide-react'
import { createBranch, getBranches, switchBranch } from '@/lib/api'
import { useAppContext } from '@/contexts/AppContext'
import { toast } from 'react-toastify'

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
  const { incrementBranchVersion } = useAppContext()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseBranch, setBaseBranch] = useState(currentBranch)
  const [branches, setBranches] = useState<Branch[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false)
  const [createdBranchName, setCreatedBranchName] = useState('')
  const [switching, setSwitching] = useState(false)

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
      const branchName = name.trim()
      await createBranch(branchName, baseBranch, description.trim() || undefined)

      // Show switch confirmation
      setCreatedBranchName(branchName)
      setShowSwitchConfirm(true)
      
      // Reset form
      setName('')
      setDescription('')
      setBaseBranch(currentBranch)
      
      onSuccess?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleSwitchToBranch() {
    setSwitching(true)
    try {
      await switchBranch(createdBranchName)
      incrementBranchVersion()
      toast.success(`Switched to branch: ${createdBranchName}`)
      setShowSwitchConfirm(false)
      onClose()
    } catch (err: any) {
      toast.error('Failed to switch branch: ' + err.message)
    } finally {
      setSwitching(false)
    }
  }

  function handleStayOnBranch() {
    toast.success(`Branch "${createdBranchName}" created`)
    setShowSwitchConfirm(false)
    onClose()
  }

  function handleClose() {
    if (creating || switching) return
    setName('')
    setDescription('')
    setBaseBranch(currentBranch)
    setError(null)
    setShowSwitchConfirm(false)
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
        {showSwitchConfirm ? (
          // Switch Confirmation Dialog
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold mb-2">Branch Created!</h2>
              <p className="text-app-text-dim text-sm">
                <span className="font-mono text-app-accent">{createdBranchName}</span> has been created successfully.
              </p>
            </div>
            <div className="bg-app-bg/50 border border-app-border rounded-lg p-4 mb-6">
              <p className="text-sm text-center">Switch to the new branch?</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleStayOnBranch}
                disabled={switching}
                className="flex-1 px-4 py-2.5 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors"
              >
                Stay on {currentBranch}
              </button>
              <button
                onClick={handleSwitchToBranch}
                disabled={switching}
                className="flex-1 px-4 py-2.5 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors flex items-center justify-center gap-2"
              >
                {switching ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Switching...</span>
                  </>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4" />
                    <span>Switch</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          // Create Form
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
