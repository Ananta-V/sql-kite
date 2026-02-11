'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, FileText, Check, X, Loader, ChevronRight, ChevronDown, AlertTriangle, Trash2, Download } from 'lucide-react'
import { getMigrations, applyMigration, applyAllMigrations, getProjectInfo, getMigrationStatus, deleteMigration, exportAppliedMigrations, exportSchema } from '@/lib/api'
import { useAppContext } from '@/contexts/AppContext'
import { toast } from 'react-toastify'

interface Migration {
  filename: string
  applied: boolean
  content: string
  branch?: string
  risk?: 'LOW' | 'MED' | 'HIGH'
  created_at?: string
  applied_at?: string
  checksum?: string
  author?: string
  error?: string
  applied_in_branches?: string[]
  can_delete?: boolean
}

export default function MigrationsPage() {
  const { branchVersion, incrementBranchVersion } = useAppContext()
  const [migrations, setMigrations] = useState<Migration[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentBranch, setCurrentBranch] = useState('main')
  const [expandedMigration, setExpandedMigration] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMigrations()
  }, [branchVersion])

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  async function loadMigrations() {
    try {
      setLoading(true)
      const [migrationsData, projectData] = await Promise.all([
        getMigrations(),
        getProjectInfo()
      ])

      // Load status for each migration (check if applied in ANY branch)
      const migrationsWithStatus = await Promise.all(
        migrationsData.map(async (m: Migration) => {
          try {
            const status = await getMigrationStatus(m.filename)
            return {
              ...m,
              risk: calculateRisk(m.content),
              applied_in_branches: status.applied_in_branches || [],
              can_delete: status.can_delete
            }
          } catch (err) {
            return {
              ...m,
              risk: calculateRisk(m.content),
              applied_in_branches: [],
              can_delete: true
            }
          }
        })
      )

      setMigrations(migrationsWithStatus)
      setCurrentBranch(projectData.currentBranch || 'main')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function calculateRisk(sql: string): 'LOW' | 'MED' | 'HIGH' {
    const upper = sql.toUpperCase()
    if (upper.includes('DROP TABLE') || upper.includes('DROP DATABASE')) return 'HIGH'
    if (upper.includes('ALTER TABLE') || upper.includes('DROP COLUMN')) return 'MED'
    return 'LOW'
  }

  async function handleApplyMigration(filename: string) {
    try {
      setApplying(filename)
      setError(null)
      await applyMigration(filename)
      await loadMigrations()
      incrementBranchVersion()
      toast.success(`Migration applied: ${filename}`)
    } catch (err: any) {
      setError(err.message)
      toast.error('Failed to apply migration: ' + err.message)
    } finally {
      setApplying(null)
    }
  }

  async function handleDeleteMigration(filename: string, appliedInBranches: string[]) {
    if (appliedInBranches.length > 0) {
      // Should not reach here due to UI disabling, but double-check
      alert(`Cannot delete migration. It has been applied in: ${appliedInBranches.join(', ')}`)
      return
    }

    if (!confirm(`Are you sure you want to delete migration "${filename}"?\n\nThis migration has not been applied to any branch.`)) {
      return
    }

    try {
      setDeleting(filename)
      setError(null)
      await deleteMigration(filename)
      await loadMigrations()
      toast.success('Migration deleted')
    } catch (err: any) {
      setError(err.message)
      toast.error('Failed to delete migration: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  async function handleApplyAll() {
    try {
      setApplying('all')
      setError(null)
      await applyAllMigrations()
      await loadMigrations()
      incrementBranchVersion()
      toast.success('All migrations applied')
    } catch (err: any) {
      setError(err.message)
      toast.error('Failed to apply migrations: ' + err.message)
    } finally {
      setApplying(null)
    }
  }

  async function handleExportApplied() {
    try {
      setExporting(true)
      setShowExportMenu(false)
      const sql = await exportAppliedMigrations()
      
      // Download the file
      const blob = new Blob([sql], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentBranch}_applied_migrations.sql`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleExportSchema() {
    try {
      setExporting(true)
      setShowExportMenu(false)
      const sql = await exportSchema()
      
      // Download the file
      const blob = new Blob([sql], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentBranch}_schema.sql`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const totalCount = migrations.length
  const pendingMigrations = migrations.filter(m => !m.applied)
  const appliedMigrations = migrations.filter(m => m.applied)
  const failedMigrations = migrations.filter(m => m.error)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-app-accent" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-app-bg overflow-hidden">
      {/* Global Context Banner */}
      <div className="px-6 py-4 border-b border-app-border bg-app-sidebar/30">
        <h1 className="text-2xl font-bold mb-1">Migrations</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-app-text-dim">Versioned database schema changes</span>
          <span className="text-app-text-dim">•</span>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-medium">
              GLOBAL
            </span>
            <span className="text-app-text-dim">
              Viewing status for branch: <span className="text-app-accent font-medium">{currentBranch}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="px-6 py-4 border-b border-app-border">
        <div className="grid grid-cols-4 gap-4 max-w-3xl">
          <div className="bg-app-sidebar border border-app-border rounded-lg px-4 py-3">
            <div className="text-2xl font-bold">{totalCount}</div>
            <div className="text-xs text-app-text-dim mt-1">Total</div>
          </div>
          <div className="bg-app-sidebar border border-yellow-500/30 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-yellow-400">{pendingMigrations.length}</div>
            <div className="text-xs text-app-text-dim mt-1">Pending</div>
          </div>
          <div className="bg-app-sidebar border border-green-500/30 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-green-400">{appliedMigrations.length}</div>
            <div className="text-xs text-app-text-dim mt-1">Applied</div>
          </div>
          <div className="bg-app-sidebar border border-red-500/30 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-red-400">{failedMigrations.length}</div>
            <div className="text-xs text-app-text-dim mt-1">Failed</div>
          </div>
        </div>

        {/* Primary Action */}
        <div className="mt-4 flex items-center gap-3">
          {pendingMigrations.length > 0 && (
            <button
              onClick={handleApplyAll}
              disabled={applying !== null}
              className="px-4 py-2 bg-app-accent text-white rounded hover:bg-app-accent/90 disabled:opacity-50 flex items-center gap-2 font-medium"
            >
              {applying === 'all' ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Applying migrations...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Apply pending migrations ({pendingMigrations.length})</span>
                </>
              )}
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="px-4 py-2 bg-app-sidebar border border-app-border text-app-text rounded hover:bg-app-bg disabled:opacity-50 flex items-center gap-2 font-medium"
            >
              {exporting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>

            {showExportMenu && !exporting && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-app-sidebar border border-app-border rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 bg-app-bg border-b border-app-border">
                  <div className="text-xs font-semibold text-app-text-dim">EXPORT OPTIONS</div>
                </div>

                <button
                  onClick={handleExportApplied}
                  disabled={appliedMigrations.length === 0}
                  className="w-full text-left px-3 py-2.5 hover:bg-app-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="font-medium text-sm">Applied migrations</div>
                  <div className="text-xs text-app-text-dim mt-0.5">
                    {appliedMigrations.length > 0 
                      ? `${appliedMigrations.length} migration${appliedMigrations.length === 1 ? '' : 's'} applied in ${currentBranch}`
                      : 'No migrations applied in this branch'}
                  </div>
                </button>

                <div className="border-t border-app-border" />

                <button
                  onClick={handleExportSchema}
                  className="w-full text-left px-3 py-2.5 hover:bg-app-bg transition-colors"
                >
                  <div className="font-medium text-sm">Full schema (current state)</div>
                  <div className="text-xs text-app-text-dim mt-0.5">
                    Complete CREATE statements from {currentBranch}
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Failed Migrations Section (conditional) */}
      {failedMigrations.length > 0 && (
        <div className="px-6 py-4 bg-red-500/5 border-b border-red-500/20">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>Failed migrations ({failedMigrations.length})</span>
          </div>
        </div>
      )}

      {/* Migrations List */}
      <div className="flex-1 overflow-y-auto p-6">
        {migrations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-app-text-dim">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg">No migrations yet</p>
            <p className="text-sm mt-1">Create your first migration in the SQL Editor</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-5xl">
            {migrations.map((migration) => (
              <MigrationRow
                key={migration.filename}
                migration={migration}
                currentBranch={currentBranch}
                expanded={expandedMigration === migration.filename}
                onToggleExpand={() => setExpandedMigration(
                  expandedMigration === migration.filename ? null : migration.filename
                )}
                onApply={() => handleApplyMigration(migration.filename)}
                onDelete={() => handleDeleteMigration(migration.filename, migration.applied_in_branches || [])}
                applying={applying === migration.filename}
                deleting={deleting === migration.filename}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MigrationRow({
  migration,
  currentBranch,
  expanded,
  onToggleExpand,
  onApply,
  onDelete,
  applying,
  deleting
}: {
  migration: Migration
  currentBranch: string
  expanded: boolean
  onToggleExpand: () => void
  onApply: () => void
  onDelete: () => void
  applying: boolean
  deleting: boolean
}) {
  const statusColor = migration.error ? 'red' : migration.applied ? 'green' : 'yellow'
  const statusText = migration.error ? 'Failed' : migration.applied ? 'Applied' : 'Pending'

  const riskColors = {
    LOW: 'bg-green-500/20 text-green-400',
    MED: 'bg-yellow-500/20 text-yellow-400',
    HIGH: 'bg-red-500/20 text-red-400'
  }

  return (
    <div className="bg-app-sidebar border border-app-border rounded-lg overflow-hidden hover:border-app-border-hover transition-colors">
      {/* Migration Row */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Expand Caret */}
          <button
            onClick={onToggleExpand}
            className="flex-shrink-0 text-app-text-dim hover:text-app-text transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>

          {/* Filename */}
          <div className="flex-1 min-w-0">
            <h3 className="font-mono text-sm font-semibold truncate">
              {migration.filename}
            </h3>
          </div>

          {/* Status Badge */}
          <span className={`
            px-2 py-1 rounded text-xs font-medium flex-shrink-0
            ${statusColor === 'green' ? 'bg-green-500/20 text-green-400' : ''}
            ${statusColor === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' : ''}
            ${statusColor === 'red' ? 'bg-red-500/20 text-red-400' : ''}
          `}>
            {statusText}
          </span>

          {/* Risk Badge */}
          {migration.risk && (
            <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${riskColors[migration.risk]}`}>
              {migration.risk}
            </span>
          )}

          {/* Actions */}
          {!migration.applied && !migration.error && (
            <button
              onClick={onApply}
              disabled={applying}
              className="px-3 py-1.5 bg-app-accent text-white text-xs rounded hover:bg-app-accent/90 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
            >
              {applying ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Apply</span>
                </>
              )}
            </button>
          )}

          {migration.error && (
            <button
              onClick={onApply}
              disabled={applying}
              className="px-3 py-1.5 bg-orange-500/20 text-orange-400 text-xs rounded hover:bg-orange-500/30 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
            >
              {applying ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  <span>Retrying...</span>
                </>
              ) : (
                <span>Retry</span>
              )}
            </button>
          )}

          {/* Delete Button - Only if NEVER applied in ANY branch */}
          {migration.can_delete && (migration.applied_in_branches || []).length === 0 ? (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50 rounded transition-colors flex-shrink-0"
              title="Delete migration"
            >
              {deleting ? (
                <Loader className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            (migration.applied_in_branches || []).length > 0 && (
              <div 
                className="p-1.5 text-app-text-dim opacity-30 cursor-not-allowed flex-shrink-0"
                title={`This migration has been applied in ${migration.applied_in_branches?.join(', ')} and cannot be deleted.`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </div>
            )
          )}
        </div>
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="border-t border-app-border px-4 py-4 bg-app-bg/50 space-y-4">
          {/* SQL Preview */}
          <div>
            <h4 className="text-xs font-semibold text-app-text-dim mb-2">SQL PREVIEW</h4>
            <pre className="text-xs bg-app-bg border border-app-border rounded p-3 overflow-x-auto font-mono max-h-60 overflow-y-auto">
              {migration.content}
            </pre>
          </div>

          {/* Metadata */}
          <div>
            <h4 className="text-xs font-semibold text-app-text-dim mb-2">METADATA</h4>
            <div className="text-xs text-app-text-dim space-y-1">
              <div>
                Created: {migration.created_at ? new Date(migration.created_at).toLocaleString() : 'Unknown'}
              </div>
              {migration.applied_at && (
                <div>
                  Applied: {new Date(migration.applied_at).toLocaleString()}
                </div>
              )}
              <div>
                Checksum: {migration.checksum ? `sha256:${migration.checksum.substring(0, 12)}...` : 'N/A'}
              </div>
              <div>
                Author: {migration.author || 'SQL Kite'}
              </div>
            </div>
          </div>

          {/* Branch Application Status */}
          <div>
            <h4 className="text-xs font-semibold text-app-text-dim mb-2">BRANCH APPLICATION STATUS</h4>
            <div className="bg-app-bg border border-app-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-app-sidebar-active">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Branch</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-app-border">
                    <td className="px-3 py-2 font-mono">{currentBranch}</td>
                    <td className="px-3 py-2">
                      <span className={`
                        px-2 py-0.5 rounded text-xs
                        ${migration.applied ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}
                      `}>
                        {migration.applied ? 'Applied' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Error Details (if failed) */}
          {migration.error && (
            <div>
              <h4 className="text-xs font-semibold text-red-400 mb-2">ERROR DETAILS</h4>
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap">
                  {migration.error}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
