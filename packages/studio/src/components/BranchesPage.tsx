'use client'

import { useEffect, useState } from 'react'
import { GitBranch, Plus, Trash2, Lock, Loader, ArrowRight } from 'lucide-react'
import { getBranches, deleteBranch, switchBranch } from '@/lib/api'
import { format } from 'date-fns'
import BranchPromoteModal from './BranchPromoteModal'

interface Branch {
  name: string
  is_current: boolean
  db_file: string
  created_at: string
  created_from?: string
  description?: string
}

interface BranchesPageProps {
  currentBranch: string
  onBranchChange?: () => void
  onCreateClick?: () => void
}

export default function BranchesPage({ currentBranch, onBranchChange, onCreateClick }: BranchesPageProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [promoteBranch, setPromoteBranch] = useState<string | null>(null)

  useEffect(() => {
    loadBranches()
  }, [])

  async function loadBranches() {
    try {
      setLoading(true)
      const data = await getBranches()
      setBranches(data.branches || [])
    } catch (error) {
      console.error('Failed to load branches:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handlePromoteSuccess() {
    setPromoteBranch(null)
    await loadBranches()
    onBranchChange?.()
  }

  async function handleDelete(branchName: string) {
    if (branchName === 'main') {
      alert('Cannot delete main branch')
      return
    }

    if (branchName === currentBranch) {
      alert('Cannot delete current branch. Switch to another branch first.')
      return
    }

    if (!confirm(`Are you sure you want to delete branch "${branchName}"?\n\nThis will remove the branch metadata, but the database file will be kept for safety.`)) {
      return
    }

    try {
      setDeleting(branchName)
      await deleteBranch(branchName)
      await loadBranches()
    } catch (error: any) {
      console.error('Failed to delete branch:', error)
      alert(`Failed to delete branch: ${error.message}`)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-app-accent" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-app-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Branches</h1>
            <p className="text-sm text-app-text-dim">
              Manage database branches • Current: <span className="text-app-accent font-medium">{currentBranch}</span>
            </p>
          </div>

          <button
            onClick={onCreateClick}
            className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover text-white rounded flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Branch</span>
          </button>
        </div>
      </div>

      {/* Branches Table */}
      <div className="flex-1 overflow-y-auto p-6">
        {branches.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-app-text-dim">
            <GitBranch className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg">No branches</p>
            <p className="text-sm mt-1">Create your first branch to get started</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="bg-app-sidebar border border-app-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-app-border bg-app-bg">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-dim uppercase">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-dim uppercase">Base</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-dim uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-dim uppercase">Last Change</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-app-text-dim uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr
                      key={branch.name}
                      className={`
                        border-b border-app-border last:border-0 transition-colors
                        ${branch.is_current ? 'bg-app-accent/5' : 'hover:bg-app-sidebar-hover'}
                      `}
                    >
                      {/* Branch Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <GitBranch className={`w-4 h-4 flex-shrink-0 ${branch.is_current ? 'text-app-accent' : 'text-app-text-dim'}`} />
                          <span className="font-medium font-mono">{branch.name}</span>
                          {branch.is_current && (
                            <span className="px-1.5 py-0.5 bg-app-accent/20 text-app-accent text-xs rounded">
                              current
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Base Branch */}
                      <td className="px-4 py-3">
                        {branch.created_from ? (
                          <span className="font-mono text-sm text-app-text-dim">{branch.created_from}</span>
                        ) : (
                          <span className="text-app-text-dim text-sm">—</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-app-text-dim">
                          {format(new Date(branch.created_at), 'MMM d')}
                        </span>
                      </td>

                      {/* Last Change */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-app-text-dim">
                          {format(new Date(branch.created_at), 'MMM d')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {branch.name === 'main' ? (
                            <div className="flex items-center gap-1 text-app-text-dim text-sm">
                              <Lock className="w-4 h-4" />
                              <span>Protected</span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => setPromoteBranch(branch.name)}
                                className="px-3 py-1.5 bg-app-accent/10 hover:bg-app-accent/20 text-app-accent rounded text-sm transition-colors flex items-center gap-1.5"
                              >
                                <ArrowRight className="w-4 h-4" />
                                <span>Promote</span>
                              </button>
                              <button
                                onClick={() => handleDelete(branch.name)}
                                disabled={deleting !== null || branch.is_current}
                                className="p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50 rounded transition-colors"
                                title={branch.is_current ? 'Cannot delete current branch' : 'Delete branch'}
                              >
                                {deleting === branch.name ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Promote Modal */}
      {promoteBranch && (
        <BranchPromoteModal
          isOpen={true}
          onClose={() => setPromoteBranch(null)}
          sourceBranch={promoteBranch}
          branches={branches.map(b => b.name)}
          onSuccess={handlePromoteSuccess}
        />
      )}
    </div>
  )
}
