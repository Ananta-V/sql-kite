'use client'

import { useState, useEffect } from 'react'
import { Download, CheckCircle, XCircle, AlertCircle, Loader2, Package, GitBranch, Clock, Database } from 'lucide-react'

interface ExportStatus {
  mainExists: boolean
  pendingMigrations: number
  databaseHealthy: boolean
  lastModified: string | null
  branchesAheadOfMain: number
  tableCount: number
  totalRows: number
}

export default function ExportPage() {
  const [status, setStatus] = useState<ExportStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [fileName, setFileName] = useState('production')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadExportStatus()
  }, [])

  async function loadExportStatus() {
    try {
      setLoading(true)
      const res = await fetch('/api/export/status')
      if (!res.ok) throw new Error('Failed to load export status')
      const data = await res.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    if (!status?.mainExists || !status?.databaseHealthy) return

    try {
      setExporting(true)
      setExportSuccess(false)
      setError(null)

      const res = await fetch('/api/export/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: fileName || 'production' })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Export failed')
      }

      // Get the blob and download it
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName || 'production'}.db`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportSuccess(true)
      
      // Reset success state after animation
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const canExport = status?.mainExists && status?.databaseHealthy && !exporting

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Package className="w-6 h-6 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold">Export Production Database</h1>
          </div>
          <p className="text-app-text-dim">
            Export a clean SQLite database from the <code className="px-1.5 py-0.5 bg-app-sidebar rounded text-emerald-400">main</code> branch for production use.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-app-text-dim" />
          </div>
        ) : error && !status ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        ) : status && (
          <>
            {/* Branch Info Card */}
            <div className="bg-app-card border border-app-border rounded-lg p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">Branch used for export</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                  <span className="text-emerald-400 font-mono font-medium">main</span>
                </div>
                <span className="text-app-text-dim text-sm">
                  (Production source — always stable)
                </span>
              </div>
            </div>

            {/* Status Checks */}
            <div className="bg-app-card border border-app-border rounded-lg p-5 mb-6">
              <h3 className="text-sm font-medium mb-4">Pre-export Checks</h3>
              <div className="space-y-3">
                <StatusRow
                  ok={status.mainExists}
                  label="main branch exists"
                />
                <StatusRow
                  ok={status.pendingMigrations === 0}
                  label={status.pendingMigrations === 0 
                    ? 'No pending migrations on main' 
                    : `${status.pendingMigrations} pending migration(s) on main`}
                  warning={status.pendingMigrations > 0}
                />
                <StatusRow
                  ok={status.databaseHealthy}
                  label="Database healthy"
                />
              </div>
            </div>

            {/* Database Stats */}
            <div className="bg-app-card border border-app-border rounded-lg p-5 mb-6">
              <h3 className="text-sm font-medium mb-4">Database Contents</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-app-text-dim" />
                  <div>
                    <div className="text-lg font-semibold">{status.tableCount}</div>
                    <div className="text-xs text-app-text-dim">Tables</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-app-text-dim" />
                  <div>
                    <div className="text-sm font-medium">
                      {status.lastModified 
                        ? formatTimeAgo(status.lastModified)
                        : 'Never modified'}
                    </div>
                    <div className="text-xs text-app-text-dim">Last modified on main</div>
                  </div>
                </div>
              </div>
              {status.branchesAheadOfMain > 0 && (
                <div className="mt-4 pt-4 border-t border-app-border">
                  <div className="flex items-center gap-2 text-sm text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>{status.branchesAheadOfMain} branch(es) have changes not in main</span>
                  </div>
                </div>
              )}
            </div>

            {/* Export Section */}
            <div className="bg-app-card border border-app-border rounded-lg p-5">
              <h3 className="text-sm font-medium mb-4">Export Settings</h3>
              
              <div className="mb-6">
                <label className="block text-sm text-app-text-dim mb-2">
                  Export file name
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="production"
                    className="flex-1 px-3 py-2 bg-app-bg border border-app-border rounded-l-md focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="px-3 py-2 bg-app-sidebar border border-l-0 border-app-border rounded-r-md text-app-text-dim">
                    .db
                  </span>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={!canExport}
                className={`
                  w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-300
                  ${canExport
                    ? exportSuccess
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-app-sidebar text-app-text-dim cursor-not-allowed'
                  }
                `}
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Exporting...</span>
                    <ExportProgressDots />
                  </>
                ) : exportSuccess ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Downloaded Successfully!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Export Database</span>
                  </>
                )}
              </button>

              {!status.mainExists && (
                <p className="mt-3 text-sm text-red-400 text-center">
                  Cannot export: main branch does not exist
                </p>
              )}
            </div>

            {/* What's Included */}
            <div className="mt-6 p-4 bg-app-sidebar/50 rounded-lg">
              <h4 className="text-sm font-medium mb-3">What's included in export:</h4>
              <ul className="text-sm text-app-text-dim space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  All tables and data from main
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Indexes, triggers, and views
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Clean SQLite file (no WAL)
                </li>
              </ul>
              <h4 className="text-sm font-medium mt-4 mb-3">What's NOT included:</h4>
              <ul className="text-sm text-app-text-dim space-y-1">
                <li className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  Branch data
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  Timeline history
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  Snapshots
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  Migration metadata
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatusRow({ ok, label, warning = false }: { ok: boolean; label: string; warning?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {ok ? (
        <CheckCircle className={`w-4 h-4 ${warning ? 'text-amber-400' : 'text-emerald-500'}`} />
      ) : (
        <XCircle className="w-4 h-4 text-red-400" />
      )}
      <span className={`text-sm ${ok ? (warning ? 'text-amber-400' : 'text-app-text') : 'text-red-400'}`}>
        {label}
      </span>
    </div>
  )
}

function ExportProgressDots() {
  return (
    <span className="flex gap-1">
      <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}
