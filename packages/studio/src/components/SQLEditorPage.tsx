'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Save, Star, ChevronDown, Camera, Copy, AlertCircle, Info, Zap, FileText, Download, Database, CheckCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import InnerSidebar from './InnerSidebar'
import { executeQuery, getTables, getTableInfo, createMigration, createSnapshot } from '@/lib/api'
import { useAppContext } from '@/contexts/AppContext'
import {
  SQLCompletionProvider,
  SQLSignatureHelpProvider,
  SQLHoverProvider
} from '@/lib/sql-autocomplete'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface ExecutionResult {
  type: 'select' | 'insert' | 'update' | 'delete' | 'ddl'
  rows?: any[]
  changes?: number
  executionTime: number
  lastInsertId?: number
}

interface ErrorDetails {
  message: string
  code?: string
  errno?: number
  location?: { line: number; column: number }
}

interface ExplainPlan {
  raw: string
  parsed: {
    scanType: string
    indexUsed?: string
    tableName?: string
    detail: string
  }[]
}

export default function SQLEditorPage() {
  const { editorState, updateSQL, updateActiveTab, addFavorite } = useAppContext()
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [error, setError] = useState<ErrorDetails | null>(null)
  const [errorHistory, setErrorHistory] = useState<Array<{ sql: string; error: ErrorDetails; timestamp: number }>>([])
  const [explainPlan, setExplainPlan] = useState<ExplainPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [migrationName, setMigrationName] = useState('')
  const [savingMigration, setSavingMigration] = useState(false)
  const [showFavoriteModal, setShowFavoriteModal] = useState(false)
  const [favoriteName, setFavoriteName] = useState('')
  const [selectedSQL, setSelectedSQL] = useState('')
  const [showSnapshotModal, setShowSnapshotModal] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [lastQueryType, setLastQueryType] = useState<string>('unknown')
  const [lastExecutedSQL, setLastExecutedSQL] = useState<string>('')
  const exportMenuRef = useRef<HTMLDivElement>(null)
  
  const completionProviderRef = useRef<SQLCompletionProvider | null>(null)
  const hoverProviderRef = useRef<SQLHoverProvider | null>(null)
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)

  // Load table schema for autocomplete
  useEffect(() => {
    loadSchemaForAutocomplete()
  }, [])

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

  async function handleExecute(customSql?: string) {
    const queryToRun = customSql || editorState.sql
    if (!queryToRun.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)
    setExplainPlan(null)
    updateActiveTab('result')

    const startTime = performance.now()

    try {
      const data = await executeQuery(queryToRun)
      const executionTime = Math.round(performance.now() - startTime)

      // Detect query type
      const queryType = detectQueryType(queryToRun)
      setLastQueryType(queryType)
      setLastExecutedSQL(queryToRun)

      setResult({
        ...data,
        executionTime
      })

      // Reload schema if it was a DDL statement
      if (/CREATE|ALTER|DROP/i.test(queryToRun)) {
        loadSchemaForAutocomplete()
      }
    } catch (err: any) {
      const errorDetails: ErrorDetails = {
        message: err.message,
        code: err.code,
        errno: err.errno
      }

      setError(errorDetails)

      // Add to error history (keep last 5)
      setErrorHistory(prev => [
        { sql: queryToRun, error: errorDetails, timestamp: Date.now() },
        ...prev.slice(0, 4)
      ])

      updateActiveTab('errors')
    } finally {
      setLoading(false)
    }
  }

  async function handleExplain() {
    const queryToRun = editorState.sql.trim()
    if (!queryToRun) return

    setLoading(true)
    updateActiveTab('explain')

    try {
      const explainQuery = `EXPLAIN QUERY PLAN ${queryToRun}`
      const data = await executeQuery(explainQuery)

      // Parse explain output
      const parsed = parseExplainPlan(data.rows || [])
      setExplainPlan({
        raw: JSON.stringify(data.rows, null, 2),
        parsed
      })
    } catch (err: any) {
      setError({ message: err.message })
      updateActiveTab('errors')
    } finally {
      setLoading(false)
    }
  }

  function detectQueryType(sql: string): string {
    const upper = sql.trim().toUpperCase()
    if (upper.startsWith('SELECT')) return 'SELECT'
    if (upper.startsWith('INSERT')) return 'INSERT'
    if (upper.startsWith('UPDATE')) return 'UPDATE'
    if (upper.startsWith('DELETE')) return 'DELETE'
    if (upper.startsWith('CREATE')) return 'CREATE'
    if (upper.startsWith('ALTER')) return 'ALTER'
    if (upper.startsWith('DROP')) return 'DROP'
    return 'UNKNOWN'
  }

  function parseExplainPlan(rows: any[]): ExplainPlan['parsed'] {
    return rows.map(row => {
      const detail = row.detail || ''
      let scanType = 'UNKNOWN'
      let indexUsed = undefined
      let tableName = undefined

      if (detail.includes('SCAN TABLE')) {
        scanType = 'TABLE_SCAN'
        const tableMatch = detail.match(/SCAN TABLE (\w+)/)
        if (tableMatch) tableName = tableMatch[1]
      }

      if (detail.includes('USING INDEX')) {
        scanType = 'INDEX_SCAN'
        const indexMatch = detail.match(/USING INDEX (\w+)/)
        if (indexMatch) indexUsed = indexMatch[1]
      }

      if (detail.includes('SEARCH TABLE')) {
        scanType = 'INDEX_SEARCH'
        const tableMatch = detail.match(/SEARCH TABLE (\w+)/)
        if (tableMatch) tableName = tableMatch[1]
      }

      return {
        scanType,
        indexUsed,
        tableName,
        detail
      }
    })
  }

  function getPerformanceHint(plan: ExplainPlan['parsed']): string | null {
    for (const step of plan) {
      if (step.scanType === 'TABLE_SCAN' && !step.detail.includes('PRIMARY KEY')) {
        return `Full table scan detected on "${step.tableName}". Consider adding an index to improve performance.`
      }
    }
    return null
  }

  function getSuggestedTable(error: string): string | null {
    // Simple table suggestion based on common typos
    // In a real app, you'd use fuzzy matching with actual table names
    if (error.includes('no such table')) {
      return 'Run PRAGMA table_list; to see available tables.'
    }
    if (error.includes('no such column')) {
      return 'Check your column names. Use PRAGMA table_info(table_name); to see columns.'
    }
    return null
  }

  function isMigrationEligible(queryType: string): boolean {
    return ['CREATE', 'ALTER', 'DROP'].includes(queryType)
  }

  async function handleSaveMigration() {
    if (!editorState.sql.trim()) {
      alert('No SQL to save as migration')
      return
    }
    setShowMigrationModal(true)
  }

  async function handleCreateMigration() {
    if (!migrationName.trim()) {
      alert('Please enter a migration name')
      return
    }

    setSavingMigration(true)
    try {
      await createMigration(migrationName.trim(), editorState.sql)
      setShowMigrationModal(false)
      setMigrationName('')
      alert('Migration created successfully!')
    } catch (err: any) {
      alert(`Failed to create migration: ${err.message}`)
    } finally {
      setSavingMigration(false)
    }
  }

  function handleSaveSelectionAsFavorite() {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection()
      const selectedText = editorRef.current.getModel().getValueInRange(selection)

      if (!selectedText.trim()) {
        alert('Please select SQL text first')
        return
      }

      setSelectedSQL(selectedText)
      setShowFavoriteModal(true)
    }
  }

  function handleCreateFavorite() {
    if (!favoriteName.trim()) {
      alert('Please enter a name for the favorite')
      return
    }

    addFavorite(favoriteName.trim(), selectedSQL)
    setShowFavoriteModal(false)
    setFavoriteName('')
    setSelectedSQL('')
  }

  async function handleTakeSnapshot() {
    setShowSnapshotModal(true)
  }

  async function handleCreateSnapshot() {
    setCreatingSnapshot(true)
    try {
      await createSnapshot(snapshotName.trim() || undefined)
      setShowSnapshotModal(false)
      setSnapshotName('')
      alert('Snapshot created successfully!')
    } catch (err: any) {
      alert(`Failed to create snapshot: ${err.message}`)
    } finally {
      setCreatingSnapshot(false)
    }
  }

  function handleExport(format: 'csv' | 'json' | 'sql' | 'markdown') {
    if (!result?.rows || result.rows.length === 0) {
      alert('No data to export')
      return
    }

    let content = ''
    let filename = ''
    let mimeType = ''

    switch (format) {
      case 'csv':
        content = exportAsCSV(result.rows)
        filename = `query_result_${Date.now()}.csv`
        mimeType = 'text/csv'
        break
      case 'json':
        content = JSON.stringify(result.rows, null, 2)
        filename = `query_result_${Date.now()}.json`
        mimeType = 'application/json'
        break
      case 'sql':
        content = exportAsSQL()
        filename = `query_${Date.now()}.sql`
        mimeType = 'text/plain'
        break
      case 'markdown':
        content = exportAsMarkdown(result.rows)
        filename = `query_result_${Date.now()}.md`
        mimeType = 'text/markdown'
        break
    }

    downloadFile(content, filename, mimeType)
    setShowExportMenu(false)
  }

  function exportAsCSV(rows: any[]): string {
    if (rows.length === 0) return ''

    const columns = Object.keys(rows[0])
    const header = columns.join(',')
    const data = rows.map(row =>
      columns.map(col => {
        const value = row[col]
        if (value === null) return 'NULL'
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    ).join('\n')

    return `${header}\n${data}`
  }

  function exportAsMarkdown(rows: any[]): string {
    if (rows.length === 0) return ''

    const columns = Object.keys(rows[0])
    const header = `| ${columns.join(' | ')} |`
    const separator = `| ${columns.map(() => '---').join(' | ')} |`
    const data = rows.map(row =>
      `| ${columns.map(col => row[col] === null ? 'NULL' : row[col]).join(' | ')} |`
    ).join('\n')

    return `${header}\n${separator}\n${data}`
  }

  function exportAsSQL(): string {
    const timestamp = new Date().toISOString()
    return `-- Exported from LocalDB\n-- Date: ${timestamp}\n-- Query Type: ${lastQueryType}\n\n${lastExecutedSQL}`
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full">
      {/* Inner Sidebar */}
      <InnerSidebar width="220px" />

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor */}
        <div className="flex-1 flex flex-col border-b border-app-border">
          {/* Editor Hint Bar */}
          <div className="px-4 py-1.5 bg-app-sidebar/30 border-b border-app-border/50 flex items-center gap-4 text-xs text-app-text-dim">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-app-bg border border-app-border rounded text-xs">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-app-bg border border-app-border rounded text-xs">↵</kbd>
              <span>Run all</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-app-bg border border-app-border rounded text-xs">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-app-bg border border-app-border rounded text-xs">⇧</kbd>
              <kbd className="px-1.5 py-0.5 bg-app-bg border border-app-border rounded text-xs">↵</kbd>
              <span>Run selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-app-bg border border-app-border rounded text-xs">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-app-bg border border-app-border rounded text-xs">Space</kbd>
              <span>Autocomplete</span>
            </div>
          </div>
          <div className="flex-1 bg-[#0f0f0f]">
            <MonacoEditor
              height="100%"
              language="sql"
              theme="vs-dark"
              value={editorState.sql}
              onChange={(value) => updateSQL(value || '')}
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
        <div className="h-96 flex flex-col bg-app-panel border-t border-app-panel-border">
          {/* Tabs + Actions */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-app-panel-border bg-app-sidebar/30 flex-shrink-0">
            <div className="flex gap-4">
              {(['result', 'errors', 'explain', 'info'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => updateActiveTab(tab)}
                  className={`
                    px-2 py-1 text-sm capitalize transition-colors font-medium
                    ${editorState.activeTab === tab
                      ? 'text-app-text border-b-2 border-app-accent'
                      : 'text-app-text-dim hover:text-app-text'
                    }
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs text-app-text-dim mr-2">
                ⌘↵ Run | ⌘⇧↵ Run Selected | ⌘⇧F Format
              </div>

              {/* Export Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={!result?.rows || result.rows.length === 0}
                  className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showExportMenu && (
                  <div className="absolute top-full mt-1 right-0 bg-app-sidebar border border-app-border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-app-sidebar-hover flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-app-sidebar-hover flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Export as JSON
                    </button>
                    <button
                      onClick={() => handleExport('markdown')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-app-sidebar-hover flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Export as Markdown
                    </button>
                    <button
                      onClick={() => handleExport('sql')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-app-sidebar-hover flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Export Query (SQL)
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleTakeSnapshot}
                className="px-3 py-1.5 text-xs bg-app-border hover:bg-app-sidebar-hover rounded transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Take snapshot
              </button>
              <button
                onClick={handleSaveSelectionAsFavorite}
                className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors flex items-center gap-1.5"
              >
                <Star className="w-3.5 h-3.5" />
                Save as Favorite
              </button>
              <button
                onClick={handleSaveMigration}
                className="px-3 py-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-colors flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save as Migration
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
            {editorState.activeTab === 'result' && (
              <div>
                {error ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                    <div className="text-red-400 font-semibold text-sm mb-1">Error</div>
                    <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                      {error.message}
                    </pre>
                  </div>
                ) : result ? (
                  <div>
                    {result.type === 'select' ? (
                      <>
                        <div className="mb-2 text-xs text-app-text-dim">
                          {result.rows?.length || 0} rows returned in {result.executionTime}ms
                        </div>
                        {(result.rows?.length || 0) === 0 ? (
                          <div className="text-app-text-dim text-center py-8 text-sm">
                            No rows returned
                          </div>
                        ) : (
                          <div className="border border-app-panel-border rounded overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-app-sidebar-active">
                                <tr>
                                  {result.rows && result.rows.length > 0 && Object.keys(result.rows[0]).map((key) => (
                                    <th key={key} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {result.rows?.map((row: any, i: number) => (
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
                        <div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-1">
                          <CheckCircle className="w-4 h-4" />
                          Success
                        </div>
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

            {editorState.activeTab === 'errors' && (
              <div>
                {error ? (
                  <div className="space-y-4">
                    {/* Error Summary */}
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-red-400 font-semibold text-sm">Error</h3>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(error.message)
                                alert('Error copied to clipboard')
                              }}
                              className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 rounded flex items-center gap-1.5"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                          </div>
                          <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                            {error.message}
                          </pre>
                          {error.code && (
                            <div className="mt-2 text-xs text-red-400">
                              Error code: {error.code}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Helpful Hint */}
                    {getSuggestedTable(error.message) && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-blue-400 font-semibold text-sm mb-1">Hint</h4>
                            <p className="text-xs text-app-text-dim">
                              {getSuggestedTable(error.message)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error History */}
                    {errorHistory.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Recent Errors</h4>
                        <div className="space-y-2">
                          {errorHistory.map((item, i) => (
                            <div key={i} className="bg-app-sidebar border border-app-border rounded p-3 text-xs">
                              <div className="text-app-text-dim mb-1">
                                {new Date(item.timestamp).toLocaleTimeString()}
                              </div>
                              <div className="text-red-300 font-mono text-xs">
                                {item.error.message}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2 opacity-50" />
                    <div className="text-app-text-dim text-sm">No errors</div>
                  </div>
                )}
              </div>
            )}

            {editorState.activeTab === 'explain' && (
              <div>
                {explainPlan ? (
                  <div className="space-y-4">
                    {/* Visual Plan */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-400" />
                          Query Execution Plan
                        </h3>
                      </div>

                      <div className="space-y-2">
                        {explainPlan.parsed.map((step, i) => (
                          <div key={i} className="bg-app-sidebar border border-app-border rounded p-3">
                            <div className="flex items-start gap-3">
                              <div className="text-app-text-dim text-xs">#{i + 1}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {step.scanType === 'INDEX_SCAN' || step.scanType === 'INDEX_SEARCH' ? (
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                                      ⚡ INDEX
                                    </span>
                                  ) : step.scanType === 'TABLE_SCAN' ? (
                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                                      📄 SCAN
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-app-border text-app-text-dim rounded text-xs font-medium">
                                      {step.scanType}
                                    </span>
                                  )}
                                  {step.tableName && (
                                    <span className="text-xs text-app-text">Table: {step.tableName}</span>
                                  )}
                                  {step.indexUsed && (
                                    <span className="text-xs text-green-400">Using: {step.indexUsed}</span>
                                  )}
                                </div>
                                <pre className="text-xs text-app-text-dim font-mono mt-1">
                                  {step.detail}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Performance Hint */}
                    {getPerformanceHint(explainPlan.parsed) && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-amber-400 font-semibold text-sm mb-1">Performance Suggestion</h4>
                            <p className="text-xs text-app-text-dim">
                              {getPerformanceHint(explainPlan.parsed)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Raw Output */}
                    <details className="bg-app-sidebar border border-app-border rounded">
                      <summary className="px-3 py-2 text-xs cursor-pointer hover:bg-app-sidebar-hover">
                        Raw Explain Output
                      </summary>
                      <pre className="px-3 py-2 text-xs text-app-text-dim font-mono border-t border-app-border overflow-x-auto">
                        {explainPlan.raw}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <button
                      onClick={handleExplain}
                      disabled={loading || !editorState.sql.trim()}
                      className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors font-medium"
                    >
                      {loading ? 'Analyzing...' : 'Run EXPLAIN QUERY PLAN'}
                    </button>
                    <p className="text-xs text-app-text-dim mt-3">
                      Analyze how SQLite will execute your query
                    </p>
                  </div>
                )}
              </div>
            )}

            {editorState.activeTab === 'info' && (
              <div className="space-y-4">
                {/* Execution Metadata */}
                {result && (
                  <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Execution Metadata
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-app-text-dim mb-1">Execution time</div>
                        <div className="font-mono">{result.executionTime}ms</div>
                      </div>
                      <div>
                        <div className="text-app-text-dim mb-1">Query type</div>
                        <div className="font-mono">{lastQueryType}</div>
                      </div>
                      {result.changes !== undefined && (
                        <div>
                          <div className="text-app-text-dim mb-1">Rows affected</div>
                          <div className="font-mono">{result.changes}</div>
                        </div>
                      )}
                      {result.rows && (
                        <div>
                          <div className="text-app-text-dim mb-1">Rows returned</div>
                          <div className="font-mono">{result.rows.length}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Migration Eligibility */}
                <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Migration Eligibility</h3>
                  {isMigrationEligible(lastQueryType) ? (
                    <div className="flex items-start gap-2 text-xs">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-green-400 mb-1">This query can be saved as a migration</p>
                        <p className="text-app-text-dim">
                          DDL statements (CREATE, ALTER, DROP) can be versioned as migrations.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-app-text-dim flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-app-text-dim mb-1">This query cannot be saved as a migration</p>
                        <p className="text-app-text-dim">
                          Only DDL statements (CREATE, ALTER, DROP) can be migrations.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Editor Features */}
                <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Editor Features</h3>
                  <div className="space-y-2 text-xs text-app-text-dim">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      SQL autocomplete enabled
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      Press Ctrl+Space for suggestions
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      Hover over keywords for documentation
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      Schema-aware column suggestions
                    </div>
                  </div>
                </div>

                {/* System Info */}
                <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">System Information</h3>
                  <div className="space-y-1 text-xs text-app-text-dim">
                    <div className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5" />
                      SQLite 3.44.0
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      Monaco Editor
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save as Migration Modal */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowMigrationModal(false)}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Save as Migration</h2>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                Migration Name
              </label>
              <input
                type="text"
                value={migrationName}
                onChange={(e) => setMigrationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !savingMigration) {
                    handleCreateMigration()
                  }
                }}
                placeholder="e.g., add_users_table or create_indexes"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
                autoFocus
              />
              <p className="text-xs text-app-text-dim mt-1">
                The migration will be automatically numbered (e.g., 001_your_name.sql)
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                SQL Preview
              </label>
              <pre className="text-xs bg-app-bg border border-app-border rounded p-3 max-h-40 overflow-auto font-mono">
                {editorState.sql}
              </pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMigrationModal(false)
                  setMigrationName('')
                }}
                disabled={savingMigration}
                className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMigration}
                disabled={savingMigration || !migrationName.trim()}
                className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors"
              >
                {savingMigration ? 'Creating...' : 'Create Migration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Favorite Modal */}
      {showFavoriteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowFavoriteModal(false)}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Save as Favorite</h2>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                Favorite Name
              </label>
              <input
                type="text"
                value={favoriteName}
                onChange={(e) => setFavoriteName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFavorite()
                  }
                }}
                placeholder="e.g., Get all users or Common joins"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                SQL Preview
              </label>
              <pre className="text-xs bg-app-bg border border-app-border rounded p-3 max-h-40 overflow-auto font-mono">
                {selectedSQL}
              </pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowFavoriteModal(false)
                  setFavoriteName('')
                  setSelectedSQL('')
                }}
                className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFavorite}
                disabled={!favoriteName.trim()}
                className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors"
              >
                Save Favorite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Take Snapshot Modal */}
      {showSnapshotModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowSnapshotModal(false)}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Take Snapshot
            </h2>

            <p className="text-sm text-app-text-dim mb-4">
              Create a point-in-time snapshot of your database. You can restore to this state later.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                Snapshot Name (Optional)
              </label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creatingSnapshot) {
                    handleCreateSnapshot()
                  }
                }}
                placeholder="e.g., before_migration or stable_v1"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
                autoFocus
              />
              <p className="text-xs text-app-text-dim mt-1">
                Leave empty to auto-generate a timestamp-based name
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSnapshotModal(false)
                  setSnapshotName('')
                }}
                disabled={creatingSnapshot}
                className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSnapshot}
                disabled={creatingSnapshot}
                className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors flex items-center gap-2"
              >
                {creatingSnapshot ? (
                  <>Creating...</>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Create Snapshot
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}