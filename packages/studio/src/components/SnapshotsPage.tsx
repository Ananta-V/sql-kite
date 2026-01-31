'use client'

import { useEffect, useState } from 'react'
import { Camera, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { getSnapshots, createSnapshot, restoreSnapshot } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadSnapshots()
  }, [])

  async function loadSnapshots() {
    try {
      const data = await getSnapshots()
      setSnapshots(data)
    } catch (error) {
      console.error('Failed to load snapshots:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSnapshot() {
    const name = prompt('Enter snapshot name (optional):')
    if (name === null) return

    setCreating(true)
    try {
      await createSnapshot(name || undefined)
      await loadSnapshots()
    } catch (error) {
      alert('Failed to create snapshot: ' + error)
    } finally {
      setCreating(false)
    }
  }

  async function handleRestore(id: number, filename: string) {
    if (!confirm(`Restore from snapshot "${filename}"? This will replace your current database and restart the server.`)) {
      return
    }

    try {
      await restoreSnapshot(id)
      alert('Snapshot restored! The page will reload.')
      window.location.reload()
    } catch (error) {
      alert('Failed to restore snapshot: ' + error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-studio-text-dim">Loading snapshots...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Snapshots</h1>
        <button
          onClick={handleCreateSnapshot}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-studio-accent hover:bg-studio-accent-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {creating ? 'Creating...' : 'Create Snapshot'}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <div className="bg-studio-sidebar border border-studio-border rounded-lg p-12 text-center">
          <Camera className="w-12 h-12 mx-auto mb-4 text-studio-text-dim opacity-50" />
          <p className="text-studio-text-dim mb-4">No snapshots yet</p>
          <button
            onClick={handleCreateSnapshot}
            className="inline-flex items-center gap-2 px-4 py-2 bg-studio-accent hover:bg-studio-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Snapshot
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="bg-studio-sidebar border border-studio-border rounded-lg p-4 hover:border-studio-hover transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold font-mono mb-1">{snapshot.filename}</h3>
                  <div className="flex gap-4 text-sm text-studio-text-dim">
                    <span>{(snapshot.size / 1024).toFixed(2)} KB</span>
                    <span>
                      {formatDistanceToNow(new Date(snapshot.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleRestore(snapshot.id, snapshot.filename)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}