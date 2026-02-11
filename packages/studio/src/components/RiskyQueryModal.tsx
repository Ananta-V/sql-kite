'use client'

import { useState } from 'react'
import { X, AlertTriangle, Camera, Play, Loader } from 'lucide-react'
import { createSnapshot } from '@/lib/api'
import { format } from 'date-fns'

interface RiskyQueryModalProps {
  isOpen: boolean
  onClose: () => void
  sql: string
  riskLevel: 'high' | 'medium'
  riskReason: string
  onProceed: () => void
}

export default function RiskyQueryModal({
  isOpen,
  onClose,
  sql,
  riskLevel,
  riskReason,
  onProceed
}: RiskyQueryModalProps) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleCreateSnapshotAndRun() {
    setCreating(true)
    setError(null)
    
    try {
      const label = `Before risky query – ${format(new Date(), 'MMM d, HH:mm')}`
      await createSnapshot({
        name: label,
        description: `Safety snapshot before executing: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`,
        type: 'auto-risky-query'
      })
      
      onProceed()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create snapshot')
      setCreating(false)
    }
  }

  function handleRunWithoutSnapshot() {
    onProceed()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className="relative bg-app-bg border border-app-border rounded-lg shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${riskLevel === 'high' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
              <AlertTriangle className={`w-5 h-5 ${riskLevel === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
            </div>
            <h2 className="text-lg font-semibold">
              {riskLevel === 'high' ? 'High Risk Query Detected' : 'Potentially Risky Query'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={creating}
            className="p-2 hover:bg-app-sidebar-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Message */}
          <div className={`p-4 rounded-lg border ${
            riskLevel === 'high' 
              ? 'bg-red-500/5 border-red-500/20' 
              : 'bg-amber-500/5 border-amber-500/20'
          }`}>
            <p className={`text-sm ${riskLevel === 'high' ? 'text-red-300' : 'text-amber-300'}`}>
              {riskReason}
            </p>
          </div>

          {/* SQL Preview */}
          <div>
            <div className="text-xs font-medium text-app-text-dim uppercase tracking-wider mb-2">
              Query
            </div>
            <div className="bg-app-sidebar border border-app-border rounded-lg p-3 font-mono text-sm text-app-text-dim max-h-24 overflow-auto">
              {sql.length > 200 ? sql.substring(0, 200) + '...' : sql}
            </div>
          </div>

          {/* Recommendation */}
          <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <Camera className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-300 font-medium">Recommended: Create a snapshot first</p>
              <p className="text-blue-400/70 mt-0.5">
                This allows you to restore your database if something goes wrong.
              </p>
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
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm text-app-text-dim hover:text-app-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRunWithoutSnapshot}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-app-sidebar-active hover:bg-app-sidebar-hover text-app-text rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Run Without Snapshot
          </button>
          <button
            onClick={handleCreateSnapshotAndRun}
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
                Snapshot & Run
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper to detect risky queries
export function detectRiskyQuery(sql: string): { isRisky: boolean; level: 'high' | 'medium'; reason: string } | null {
  const normalized = sql.toUpperCase().trim()
  
  // High risk patterns
  if (normalized.includes('DROP TABLE') || normalized.includes('DROP DATABASE')) {
    return {
      isRisky: true,
      level: 'high',
      reason: 'This query will permanently delete a table or database. All data will be lost and cannot be recovered without a backup.'
    }
  }
  
  if (normalized.includes('TRUNCATE')) {
    return {
      isRisky: true,
      level: 'high',
      reason: 'TRUNCATE will remove all rows from the table. This action cannot be undone.'
    }
  }
  
  if (normalized.includes('DELETE') && !normalized.includes('WHERE')) {
    return {
      isRisky: true,
      level: 'high',
      reason: 'DELETE without a WHERE clause will remove ALL rows from the table.'
    }
  }
  
  // Medium risk patterns
  if (normalized.includes('ALTER TABLE') && (normalized.includes('DROP COLUMN') || normalized.includes('DROP CONSTRAINT'))) {
    return {
      isRisky: true,
      level: 'medium',
      reason: 'This ALTER TABLE statement will remove a column or constraint. Data in the column will be lost.'
    }
  }
  
  if (normalized.includes('UPDATE') && !normalized.includes('WHERE')) {
    return {
      isRisky: true,
      level: 'medium',
      reason: 'UPDATE without a WHERE clause will modify ALL rows in the table.'
    }
  }
  
  if (normalized.includes('DROP INDEX') || normalized.includes('DROP TRIGGER') || normalized.includes('DROP VIEW')) {
    return {
      isRisky: true,
      level: 'medium',
      reason: 'This query will permanently remove a database object.'
    }
  }
  
  return null
}
