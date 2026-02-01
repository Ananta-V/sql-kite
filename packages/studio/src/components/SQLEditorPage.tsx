'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, FileCode } from 'lucide-react'
import dynamic from 'next/dynamic'
import InnerSidebar from './InnerSidebar'
import { executeQuery, getTables, getTableInfo } from '@/lib/api'
import { 
  SQLCompletionProvider, 
  SQLSignatureHelpProvider, 
  SQLHoverProvider 
} from '@/lib/sql-autocomplete'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export default function SQLEditorPage() {
  const [sql, setSql] = useState('-- Write your SQL query here\n\n-- Press Ctrl+Space for autocomplete\n')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'result' | 'errors' | 'explain' | 'info'>('result')
  
  const completionProviderRef = useRef<SQLCompletionProvider | null>(null)
  const hoverProviderRef = useRef<SQLHoverProvider | null>(null)
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)

  // Load table schema for autocomplete
  useEffect(() => {
    loadSchemaForAutocomplete()
  }, [])

  async function loadSchemaForAutocomplete() {
    try {
      const tables = await getTables()
      
      // Load detailed schema for each table
      const tableSchemas = await Promise.all(
        tables.map(async (table: any) => {
          const info = await getTableInfo(table.name)
          return {
            name: table.name,
            columns: info.columns.map((col: any) => ({
              name: col.name,
              type: col.type
            }))
          }
        })
      )

      // Update providers with schema
      if (completionProviderRef.current) {
        completionProviderRef.current.updateTables(tableSchemas)
      }
      if (hoverProviderRef.current) {
        hoverProviderRef.current.updateTables(tableSchemas)
      }
    } catch (error) {
      console.error('Failed to load schema for autocomplete:', error)
    }
  }

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor
    monacoRef.current = monaco

    // Initialize providers
    completionProviderRef.current = new SQLCompletionProvider()
    hoverProviderRef.current = new SQLHoverProvider()

    // Register completion provider
    monaco.languages.registerCompletionItemProvider('sql', completionProviderRef.current)
    
    // Register signature help provider
    monaco.languages.registerSignatureHelpProvider('sql', new SQLSignatureHelpProvider())
    
    // Register hover provider
    monaco.languages.registerHoverProvider('sql', hoverProviderRef.current)

    // Custom key bindings
    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
      ],
      run: () => {
        handleExecute()
      }
    })

    editor.addAction({
      id: 'run-selected',
      label: 'Run Selected Query',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter
      ],
      run: () => {
        const selection = editor.getSelection()
        const selectedText = editor.getModel().getValueInRange(selection)
        if (selectedText.trim()) {
          handleExecute(selectedText)
        } else {
          handleExecute()
        }
      }
    })

    // Format SQL action
    editor.addAction({
      id: 'format-sql',
      label: 'Format SQL',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF
      ],
      run: () => {
        editor.getAction('editor.action.formatDocument').run()
      }
    })

    // Reload schema
    loadSchemaForAutocomplete()
  }

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

  async function handleExecute(customSql?: string) {
    const queryToRun = customSql || sql
    if (!queryToRun.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)
    setActiveTab('result')

    try {
      const data = await executeQuery(queryToRun)
      setResult(data)
      
      // Reload schema if it was a DDL statement
      if (/CREATE|ALTER|DROP/i.test(queryToRun)) {
        loadSchemaForAutocomplete()
      }
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
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 16, bottom: 16 },
                fontFamily: 'Monaco, Menlo, "Courier New", monospace',
                suggestOnTriggerCharacters: true,
                quickSuggestions: {
                  other: true,
                  comments: false,
                  strings: false
                },
                parameterHints: {
                  enabled: true
                },
                suggest: {
                  showKeywords: true,
                  showSnippets: true,
                  showFunctions: true,
                  snippetsPreventQuickSuggestions: false
                },
                formatOnPaste: true,
                formatOnType: true,
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                bracketPairColorization: {
                  enabled: true
                }
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
              <div className="text-xs text-app-text-dim mr-2">
                ⌘↵ Run | ⌘⇧↵ Run Selected | ⌘⇧F Format
              </div>
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
                onClick={() => handleExecute()}
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
                    Click "Run selected" or press <kbd className="px-1.5 py-0.5 bg-app-sidebar-active rounded text-xs">⌘↵</kbd> to execute
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
                Run EXPLAIN QUERY PLAN to see query execution plan
              </div>
            )}

            {activeTab === 'info' && (
              <div className="text-xs text-app-text-dim space-y-2">
                <div>✓ SQL autocomplete enabled</div>
                <div>✓ Press Ctrl+Space for suggestions</div>
                <div>✓ Hover over keywords for documentation</div>
                <div>✓ Schema-aware column suggestions</div>
                <div className="pt-2 border-t border-app-panel-border mt-2">
                  <div>SQLite 3.44.0</div>
                  <div>Monaco Editor</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}