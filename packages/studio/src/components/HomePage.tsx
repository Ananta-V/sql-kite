'use client'

import { useEffect, useState } from 'react'
import { Database, Table2, Code, Clock } from 'lucide-react'
import { getTables, getTimeline } from '@/lib/api'
import ImportWizardModal from './ImportWizardModal'
import { useAppContext } from '@/contexts/AppContext'

export default function HomePage({ projectInfo }: any) {
  const { branchVersion } = useAppContext()
  const [tables, setTables] = useState<any[]>([])
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [importSession, setImportSession] = useState<any>(null)

  useEffect(() => {
    loadData()
    checkPendingImport()
  }, [branchVersion])

  async function loadData() {
    try {
      const [tablesData, timelineData] = await Promise.all([
        getTables(),
        getTimeline(5, 0)
      ])
      setTables(tablesData)
      setRecentEvents(timelineData.events)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  async function checkPendingImport() {
    try {
      const response = await fetch('/api/import/pending')
      const data = await response.json()
      
      if (data.pending) {
        setImportSession(data)
        setShowImportWizard(true)
      }
    } catch (error) {
      console.error('Failed to check pending import:', error)
    }
  }

  async function handleImportComplete() {
    setShowImportWizard(false)
    
    // Clear pending import session
    try {
      await fetch('/api/import/pending', { method: 'DELETE' })
    } catch (error) {
      console.error('Failed to clear import session:', error)
    }

    // Reload data
    loadData()
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          Welcome to {projectInfo?.name || 'LocalDB Studio'}
        </h1>
        <p className="text-studio-text-dim mb-8">
          Local SQLite database management platform
        </p>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={Table2}
            label="Tables"
            value={tables.length}
            color="text-blue-400"
          />
          <StatCard
            icon={Code}
            label="Recent Queries"
            value={recentEvents.filter(e => e.type === 'sql_executed').length}
            color="text-green-400"
          />
          <StatCard
            icon={Clock}
            label="Total Events"
            value={recentEvents.length}
            color="text-purple-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-studio-sidebar border border-studio-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Table2 className="w-5 h-5" />
              Tables
            </h2>
            {tables.length === 0 ? (
              <p className="text-studio-text-dim text-sm">No tables yet</p>
            ) : (
              <div className="space-y-2">
                {tables.slice(0, 5).map(table => (
                  <div
                    key={table.name}
                    className="flex items-center justify-between p-2 rounded hover:bg-studio-hover"
                  >
                    <span className="font-mono text-sm">{table.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-studio-sidebar border border-studio-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Activity
            </h2>
            {recentEvents.length === 0 ? (
              <p className="text-studio-text-dim text-sm">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {recentEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-2 rounded hover:bg-studio-hover"
                  >
                    <div className="text-sm font-medium">{formatEventType(event.type)}</div>
                    <div className="text-xs text-studio-text-dim mt-1">
                      {new Date(event.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showImportWizard && importSession && (
        <ImportWizardModal
          isOpen={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onComplete={handleImportComplete}
          initialData={importSession}
        />
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-studio-sidebar border border-studio-border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-studio-text-dim text-sm mb-1">{label}</div>
          <div className="text-3xl font-bold">{value}</div>
        </div>
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
    </div>
  )
}

function formatEventType(type: string): string {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}