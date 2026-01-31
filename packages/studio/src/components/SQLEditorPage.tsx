'use client'

import { useState } from 'react'
import { Play, FileCode, Star, Lock } from 'lucide-react'
import dynamic from 'next/dynamic'
import InnerSidebar from './InnerSidebar'
import { executeQuery } from '@/lib/api'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export default function SQLEditorPage() {
  const [sql, setSql] = useState('-- Write your SQL query here\nSELECT * FROM sqlite_master;')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'result' | 'errors' | 'explain' | 'info'>('result')

  // Inner sidebar data
  const sidebarSections = [
    {
      id: 'favorites',
      label: 'Favorites',
      items: []
    },
    {
      id: 'private',
      label: 'Private',
      items: []
    },
    {
      id: 'templates',
      label: 'Templates',
      items: [
        { id: '1', label: 'Select all users', icon: <FileCode className="w-3 h-3" /> },
        { id: '2', label: 'Create table template', icon: <FileCode className="w-3 h-3" /> }
      ]
    }
  ]

  async function handleExecute() {
    if (!sql.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)
    setActiveTab('result')

    try {
      const data = await executeQuery(sql)
      setResult(data)
    } catch (err: any) {
      setError(err.message)
      setActiveTab('errors')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Inner Sidebar */}
      <InnerSidebar sections={sidebarSections} width="220px" />

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor */}
        <div className="flex-1 flex flex-col border-b border-app-border">
          <div className="flex-1 bg-[#0f0f0f]">
            <MonacoEditor
              height="100%"
              language="sql"
              theme="vs-dark"
              value={sql}
              onChange={(value) => setSql(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 16, bottom: 16 },
                fontFamily: 'Monaco, Menlo, "Courier New", monospace',
              }}
            />
          </div>
        </div>

        {/* Results Panel */}
        <div className="h-80 flex flex-col bg-app-panel border-t border-app-panel-border">
          {/* Tabs + Actions */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-app-panel-border">
            <div className="flex gap-4">
              {(['result', 'errors', 'explain', 'info'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    px-2 py-1 text-sm capitalize transition-colors
                    ${activeTab === tab
                      ? 'text-app-text border-b-2 border-app-accent'
                      : 'text-app-text-dim hover:text-app-text'
                    }
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors">
                Export
              </button>
              <button className="px-3 py-1.5 text-xs bg-app-border hover:bg-app-sidebar-hover rounded transition-colors">
                Take snapshot
              </button>
              <button className="px-3 py-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-colors">
                Run migration
              </button>
              <button
                onClick={handleExecute}
                disabled={loading}
                className="px-4 py-1.5 text-xs bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors font-medium"
              >
                {loading ? 'Running...' : 'Run selected'}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'result' && (
              <div>
                {error ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                    <div className="text-red-400 font-semibold text-sm mb-1">Error</div>
                    <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                      {error}
                    </pre>
                  </div>
                ) : result ? (
                  <div>
                    {result.type === 'select' ? (
                      <>
                        <div className="mb-2 text-xs text-app-text-dim">
                          {result.rows.length} rows returned in {result.executionTime}ms
                        </div>
                        {result.rows.length === 0 ? (
                          <div className="text-app-text-dim text-center py-8 text-sm">
                            No rows returned
                          </div>
                        ) : (
                          <div className="border border-app-panel-border rounded overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-app-sidebar-active">
                                <tr>
                                  {Object.keys(result.rows[0]).map((key) => (
                                    <th key={key} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {result.rows.map((row: any, i: number) => (
                                  <tr key={i} className="border-t border-app-panel-border hover:bg-app-sidebar-hover">
                                    {Object.values(row).map((value: any, j: number) => (
                                      <td key={j} className="px-3 py-2 font-mono">
                                        {value === null ? (
                                          <span className="text-app-text-dim italic">NULL</span>
                                        ) : (
                                          String(value)
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                        <div className="text-green-400 font-semibold text-sm mb-1">Success</div>
                        <div className="text-xs text-app-text-dim">
                          {result.changes} row(s) affected in {result.executionTime}ms
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-app-text-dim text-center py-8 text-sm">
                    Click "Run selected" to execute your query
                  </div>
                )}
              </div>
            )}

            {activeTab === 'errors' && (
              <div>
                {error ? (
                  <pre className="text-xs text-red-300 font-mono">{error}</pre>
                ) : (
                  <div className="text-app-text-dim text-sm">No errors</div>
                )}
              </div>
            )}

            {activeTab === 'explain' && (
              <div className="text-app-text-dim text-sm">
                Run EXPLAIN to see query plan
              </div>
            )}

            {activeTab === 'info' && (
              <div className="text-xs text-app-text-dim space-y-2">
                <div>Editor ready</div>
                <div>SQLite 3.44.0</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}