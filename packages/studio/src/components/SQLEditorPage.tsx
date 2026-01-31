'use client'

import { useState } from 'react'
import { Play, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { executeQuery } from '@/lib/api'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export default function SQLEditorPage() {
  const [sql, setSql] = useState('-- Write your SQL query here\nSELECT * FROM sqlite_master;')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleExecute() {
    if (!sql.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await executeQuery(sql)
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor */}
      <div className="flex-1 flex flex-col border-b border-studio-border">
        <div className="bg-studio-sidebar border-b border-studio-border px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium">SQL Editor</span>
          <button
            onClick={handleExecute}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 bg-studio-accent hover:bg-studio-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run (⌘↵)
              </>
            )}
          </button>
        </div>

        <div className="flex-1">
          <MonacoEditor
            height="100%"
            language="sql"
            theme="vs-dark"
            value={sql}
            onChange={(value) => setSql(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto bg-studio-sidebar">
        <div className="px-4 py-2 border-b border-studio-border">
          <span className="text-sm font-medium">Results</span>
        </div>

        <div className="p-4">
          {error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="text-red-400 font-semibold mb-2">Error</div>
              <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono">
                {error}
              </pre>
            </div>
          ) : result ? (
            <div>
              {result.type === 'select' ? (
                <>
                  <div className="mb-3 text-sm text-studio-text-dim">
                    {result.rows.length} rows returned in {result.executionTime}ms
                  </div>
                  {result.rows.length === 0 ? (
                    <div className="text-studio-text-dim text-center py-8">
                      No rows returned
                    </div>
                  ) : (
                    <div className="border border-studio-border rounded-lg overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-studio-hover">
                          <tr>
                            {Object.keys(result.rows[0]).map((key) => (
                              <th key={key} className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((row: any, i: number) => (
                            <tr key={i} className="border-t border-studio-border hover:bg-studio-hover">
                              {Object.values(row).map((value: any, j: number) => (
                                <td key={j} className="px-4 py-3 text-sm font-mono">
                                  {value === null ? (
                                    <span className="text-studio-text-dim italic">NULL</span>
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
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="text-green-400 font-semibold mb-2">Success</div>
                  <div className="text-sm text-studio-text-dim">
                    {result.changes} row(s) affected in {result.executionTime}ms
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-studio-text-dim text-center py-8">
              Click "Run" to execute your query
            </div>
          )}
        </div>
      </div>
    </div>
  )
}