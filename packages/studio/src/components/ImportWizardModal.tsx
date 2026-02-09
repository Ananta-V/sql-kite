'use client'

import { useState } from 'react'
import { AlertTriangle, Database, Loader, CheckCircle, X } from 'lucide-react'

interface ImportWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  initialData: {
    sourcePath: string
    suggestedName: string
    validated: boolean
    metadata?: {
      userVersion: number
      journalMode: string
      tableCount: number
    }
  } | null
}

export default function ImportWizardModal({ isOpen, onClose, initialData, onComplete }: ImportWizardModalProps) {
  const [projectName, setProjectName] = useState(initialData?.suggestedName || '')
  const [importMode, setImportMode] = useState<'copy' | 'link'>('copy')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')

  if (!isOpen || !initialData) return null

  async function handleImport() {
    if (!projectName.trim()) {
      setError('Project name is required')
      return
    }

    if (!/^[a-z0-9-]+$/.test(projectName)) {
      setError('Project name must contain only lowercase letters, numbers, and hyphens')
      return
    }

    setImporting(true)
    setError(null)
    setProgress('Preparing import...')

    try {
      // Step 1: Create project structure
      setProgress('Creating project structure...')
      const createRes = await fetch('/api/import/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          sourcePath: initialData!.sourcePath,
          importMode
        })
      })

      if (!createRes.ok) {
        const data = await createRes.json()
        throw new Error(data.error || 'Failed to create project')
      }

      // Step 2: Copy database with WAL checkpoint
      setProgress('Copying database files...')
      const copyRes = await fetch('/api/import/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          sourcePath: initialData!.sourcePath,
          importMode
        })
      })

      if (!copyRes.ok) {
        const data = await copyRes.json()
        throw new Error(data.error || 'Failed to copy database')
      }

      // Step 3: Create baseline snapshot
      setProgress('Creating baseline snapshot...')
      const snapshotRes = await fetch('/api/import/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName })
      })

      if (!snapshotRes.ok) {
        const data = await snapshotRes.json()
        throw new Error(data.error || 'Failed to create baseline snapshot')
      }

      // Step 4: Finalize import
      setProgress('Finalizing import...')
      const finalizeRes = await fetch('/api/import/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName })
      })

      if (!finalizeRes.ok) {
        const data = await finalizeRes.json()
        throw new Error(data.error || 'Failed to finalize import')
      }

      const finalizeData = await finalizeRes.json()

      setProgress('Import complete!')

      if (onComplete) {
        await Promise.resolve(onComplete())
      }

      if (finalizeData?.server?.port) {
        setProgress('Launching Studio...')
        setTimeout(() => {
          window.location.href = `http://localhost:${finalizeData.server.port}`
        }, 800)
        return
      }

      // Wait a moment for user to see success
      setTimeout(() => {
        onClose()
      }, 1000)

    } catch (err: any) {
      setError(err.message)
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-app-sidebar border border-app-border rounded-lg shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-app-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-app-accent" />
            <h2 className="text-xl font-semibold">Import SQLite Database</h2>
          </div>
          {!importing && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-app-bg rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Source Info */}
          <div className="bg-app-bg border border-app-border rounded-lg p-4">
            <div className="text-xs font-semibold text-app-text-dim mb-2">SOURCE DATABASE</div>
            <div className="font-mono text-sm text-app-text break-all">
              {initialData.sourcePath}
            </div>
            {initialData.metadata && (
              <div className="mt-3 flex gap-4 text-xs text-app-text-dim">
                <div>Tables: {initialData.metadata.tableCount}</div>
                <div>•</div>
                <div>Journal: {initialData.metadata.journalMode}</div>
                <div>•</div>
                <div>Version: {initialData.metadata.userVersion}</div>
              </div>
            )}
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.toLowerCase())}
              disabled={importing}
              placeholder="my-database"
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded focus:outline-none focus:border-app-accent disabled:opacity-50 font-mono text-sm"
            />
            <p className="text-xs text-app-text-dim mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* Import Mode */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Import Mode
            </label>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                importMode === 'copy' 
                  ? 'border-app-accent bg-app-accent/10' 
                  : 'border-app-border hover:border-app-accent/50'
              }`}>
                <input
                  type="radio"
                  name="importMode"
                  value="copy"
                  checked={importMode === 'copy'}
                  onChange={(e) => setImportMode('copy')}
                  disabled={importing}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">Copy into project (Recommended)</div>
                  <div className="text-xs text-app-text-dim mt-1">
                    Creates a safe copy. Original file will not be modified.
                  </div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                importMode === 'link' 
                  ? 'border-app-accent bg-app-accent/10' 
                  : 'border-app-border hover:border-app-accent/50'
              }`}>
                <input
                  type="radio"
                  name="importMode"
                  value="link"
                  checked={importMode === 'link'}
                  onChange={(e) => setImportMode('link')}
                  disabled={importing}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">Link original file (Advanced)</div>
                  <div className="text-xs text-app-text-dim mt-1">
                    Work directly with the original file. Changes affect original.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-amber-400 mb-1">Important</div>
                <div className="text-app-text-dim">
                  {importMode === 'copy' 
                    ? 'A complete copy will be created. Your original database will remain untouched.'
                    : 'Link mode works directly with your original file. All changes will affect the original database.'}
                </div>
              </div>
            </div>
          </div>

          {/* Progress */}
          {importing && progress && (
            <div className="bg-app-bg border border-app-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader className="w-5 h-5 animate-spin text-app-accent" />
                <div className="text-sm text-app-text">{progress}</div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div className="text-sm text-red-400">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border flex items-center justify-between">
          <div className="text-xs text-app-text-dim">
            ✓ Database validated successfully
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-sm border border-app-border rounded hover:bg-app-bg disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !projectName.trim()}
              className="px-4 py-2 text-sm bg-app-accent text-white rounded hover:bg-app-accent/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {importing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Import Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
