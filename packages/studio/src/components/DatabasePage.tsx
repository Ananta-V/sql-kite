'use client'

import { useEffect, useState } from 'react'
import { Table2, ChevronRight, ChevronDown, Eye, Zap, Code, Copy, CheckCircle, Database as DatabaseIcon } from 'lucide-react'
import { getTables, getTableInfo, executeQuery } from '@/lib/api'

interface DBObject {
  name: string
  type: 'table' | 'view' | 'index' | 'trigger'
}

interface Column {
  name: string
  type: string
  notNull: boolean
  defaultValue: string | null
  primaryKey: boolean
}

interface Constraint {
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE'
  columns: string[]
  referencedTable?: string
  referencedColumns?: string[]
}

export default function DatabasePage() {
  const [tables, setTables] = useState<DBObject[]>([])
  const [views, setViews] = useState<DBObject[]>([])
  const [indexes, setIndexes] = useState<DBObject[]>([])
  const [triggers, setTriggers] = useState<DBObject[]>([])
  const [selectedObject, setSelectedObject] = useState<{ type: string; name: string } | null>(null)
  const [objectDetails, setObjectDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'columns' | 'constraints' | 'indexes' | 'sql'>('columns')

  // Sidebar sections state
  const [tablesCollapsed, setTablesCollapsed] = useState(false)
  const [viewsCollapsed, setViewsCollapsed] = useState(true)
  const [indexesCollapsed, setIndexesCollapsed] = useState(true)
  const [triggersCollapsed, setTriggersCollapsed] = useState(true)

  useEffect(() => {
    loadDatabaseObjects()
  }, [])

  useEffect(() => {
    if (selectedObject) {
      loadObjectDetails(selectedObject.type, selectedObject.name)
    }
  }, [selectedObject])

  async function loadDatabaseObjects() {
    try {
      // Get schema objects
      const schemaQuery = `
        SELECT name, type
        FROM sqlite_master
        WHERE type IN ('table', 'view', 'index', 'trigger')
        AND name NOT LIKE 'sqlite_%'
        ORDER BY type, name
      `
      const schemaResult = await executeQuery(schemaQuery)

      const tablesList: DBObject[] = []
      const viewsList: DBObject[] = []
      const indexesList: DBObject[] = []
      const triggersList: DBObject[] = []

      schemaResult.rows?.forEach((row: any) => {
        const obj: DBObject = { name: row.name, type: row.type }

        switch (row.type) {
          case 'table':
            tablesList.push(obj)
            break
          case 'view':
            viewsList.push(obj)
            break
          case 'index':
            indexesList.push(obj)
            break
          case 'trigger':
            triggersList.push(obj)
            break
        }
      })

      setTables(tablesList)
      setViews(viewsList)
      setIndexes(indexesList)
      setTriggers(triggersList)

      // Auto-select first table
      if (tablesList.length > 0 && !selectedObject) {
        setSelectedObject({ type: 'table', name: tablesList[0].name })
      }
    } catch (error) {
      console.error('Failed to load database objects:', error)
    }
  }

  async function loadObjectDetails(type: string, name: string) {
    setLoading(true)
    try {
      if (type === 'table') {
        const info = await getTableInfo(name)

        // Get indexes for this table
        const indexQuery = `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='${name}' AND name NOT LIKE 'sqlite_%'`
        const indexResult = await executeQuery(indexQuery)

        // Get SQL definition
        const sqlQuery = `SELECT sql FROM sqlite_master WHERE type='table' AND name='${name}'`
        const sqlResult = await executeQuery(sqlQuery)

        setObjectDetails({
          ...info,
          indexes: indexResult.rows || [],
          sql: sqlResult.rows?.[0]?.sql || ''
        })
      } else if (type === 'view' || type === 'index' || type === 'trigger') {
        const query = `SELECT sql FROM sqlite_master WHERE type='${type}' AND name='${name}'`
        const result = await executeQuery(query)
        setObjectDetails({ sql: result.rows?.[0]?.sql || '' })
      }
    } catch (error) {
      console.error('Failed to load object details:', error)
    } finally {
      setLoading(false)
    }
  }

  function parseConstraints(columns: Column[]): Constraint[] {
    const constraints: Constraint[] = []

    // Primary keys
    const pkColumns = columns.filter(c => c.primaryKey).map(c => c.name)
    if (pkColumns.length > 0) {
      constraints.push({ type: 'PRIMARY KEY', columns: pkColumns })
    }

    return constraints
  }

  function copySQLToClipboard() {
    if (objectDetails?.sql) {
      navigator.clipboard.writeText(objectDetails.sql)
      alert('SQL copied to clipboard')
    }
  }

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Database Objects Navigator */}
      <div className="w-64 bg-app-sidebar border-r border-app-border overflow-y-auto flex-shrink-0">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <DatabaseIcon className="w-5 h-5 text-app-accent" />
            <h2 className="text-lg font-semibold">Schema</h2>
          </div>

          {/* Tables Section */}
          <div className="mb-4">
            <button
              onClick={() => setTablesCollapsed(!tablesCollapsed)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-app-text-dim hover:text-app-text transition-colors"
            >
              {tablesCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <Table2 className="w-4 h-4" />
              <span>Tables ({tables.length})</span>
            </button>
            {!tablesCollapsed && (
              <div className="ml-6 mt-1 space-y-0.5">
                {tables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => {
                      setSelectedObject({ type: 'table', name: table.name })
                      setActiveTab('columns')
                    }}
                    className={`
                      w-full text-left px-3 py-1.5 text-sm rounded transition-colors
                      ${selectedObject?.type === 'table' && selectedObject?.name === table.name
                        ? 'bg-app-sidebar-active text-app-text'
                        : 'text-app-text-dim hover:bg-app-sidebar-hover hover:text-app-text'
                      }
                    `}
                  >
                    {table.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Views Section */}
          {views.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setViewsCollapsed(!viewsCollapsed)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-app-text-dim hover:text-app-text transition-colors"
              >
                {viewsCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Eye className="w-4 h-4" />
                <span>Views ({views.length})</span>
              </button>
              {!viewsCollapsed && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {views.map((view) => (
                    <button
                      key={view.name}
                      onClick={() => setSelectedObject({ type: 'view', name: view.name })}
                      className={`
                        w-full text-left px-3 py-1.5 text-sm rounded transition-colors
                        ${selectedObject?.type === 'view' && selectedObject?.name === view.name
                          ? 'bg-app-sidebar-active text-app-text'
                          : 'text-app-text-dim hover:bg-app-sidebar-hover hover:text-app-text'
                        }
                      `}
                    >
                      {view.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Indexes Section */}
          {indexes.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setIndexesCollapsed(!indexesCollapsed)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-app-text-dim hover:text-app-text transition-colors"
              >
                {indexesCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Zap className="w-4 h-4" />
                <span>Indexes ({indexes.length})</span>
              </button>
              {!indexesCollapsed && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {indexes.map((index) => (
                    <button
                      key={index.name}
                      onClick={() => setSelectedObject({ type: 'index', name: index.name })}
                      className={`
                        w-full text-left px-3 py-1.5 text-sm rounded transition-colors
                        ${selectedObject?.type === 'index' && selectedObject?.name === index.name
                          ? 'bg-app-sidebar-active text-app-text'
                          : 'text-app-text-dim hover:bg-app-sidebar-hover hover:text-app-text'
                        }
                      `}
                    >
                      {index.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Triggers Section */}
          {triggers.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setTriggersCollapsed(!triggersCollapsed)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-app-text-dim hover:text-app-text transition-colors"
              >
                {triggersCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Code className="w-4 h-4" />
                <span>Triggers ({triggers.length})</span>
              </button>
              {!triggersCollapsed && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {triggers.map((trigger) => (
                    <button
                      key={trigger.name}
                      onClick={() => setSelectedObject({ type: 'trigger', name: trigger.name })}
                      className={`
                        w-full text-left px-3 py-1.5 text-sm rounded transition-colors
                        ${selectedObject?.type === 'trigger' && selectedObject?.name === trigger.name
                          ? 'bg-app-sidebar-active text-app-text'
                          : 'text-app-text-dim hover:bg-app-sidebar-hover hover:text-app-text'
                        }
                      `}
                    >
                      {trigger.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Object Inspector */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedObject ? (
          <div className="flex items-center justify-center h-full text-app-text-dim">
            <div className="text-center">
              <DatabaseIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">Database Schema Inspector</p>
              <p className="text-sm">Select a table, view, index, or trigger to inspect</p>
              <div className="mt-6 max-w-md mx-auto text-xs space-y-2">
                <div className="flex items-center gap-2 text-app-text-dim">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Read-only inspection - no schema changes</span>
                </div>
                <div className="flex items-center gap-2 text-app-text-dim">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Reflects current branch state</span>
                </div>
                <div className="flex items-center gap-2 text-app-text-dim">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Safe to explore without consequences</span>
                </div>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-app-text-dim">Loading...</div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-app-border bg-app-sidebar/30 flex-shrink-0">
              <h1 className="text-2xl font-bold mb-1">{selectedObject.name}</h1>
              <p className="text-sm text-app-text-dim capitalize">{selectedObject.type}</p>
            </div>

            {/* Tabs for Tables */}
            {selectedObject.type === 'table' && (
              <>
                <div className="px-6 py-2 border-b border-app-border bg-app-sidebar/20 flex-shrink-0">
                  <div className="flex gap-4">
                    {(['columns', 'constraints', 'indexes', 'sql'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`
                          px-2 py-1.5 text-sm capitalize transition-colors font-medium
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
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto p-6">
                  {activeTab === 'columns' && (
                    <div>
                      <h3 className="text-sm font-semibold text-app-text-dim mb-3 uppercase tracking-wide">Columns</h3>
                      <div className="bg-app-panel border border-app-panel-border rounded overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-app-sidebar-active">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Column</th>
                              <th className="px-4 py-3 text-left font-medium">Type</th>
                              <th className="px-4 py-3 text-left font-medium">Nullable</th>
                              <th className="px-4 py-3 text-left font-medium">Default</th>
                            </tr>
                          </thead>
                          <tbody>
                            {objectDetails?.columns?.map((col: Column, i: number) => (
                              <tr key={i} className="border-t border-app-panel-border">
                                <td className="px-4 py-3 font-mono flex items-center gap-2">
                                  {col.name}
                                  {col.primaryKey && (
                                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                                      PK
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-app-text-dim">{col.type || 'ANY'}</td>
                                <td className="px-4 py-3">
                                  {col.notNull ? (
                                    <span className="text-red-400">No</span>
                                  ) : (
                                    <span className="text-green-400">Yes</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-mono text-app-text-dim">
                                  {col.defaultValue || <span className="italic">none</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'constraints' && (
                    <div>
                      <h3 className="text-sm font-semibold text-app-text-dim mb-3 uppercase tracking-wide">Constraints</h3>
                      <div className="space-y-3">
                        {parseConstraints(objectDetails?.columns || []).map((constraint, i) => (
                          <div key={i} className="bg-app-sidebar border border-app-border rounded p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                                {constraint.type}
                              </span>
                            </div>
                            <code className="text-sm text-app-text">
                              {constraint.type} ({constraint.columns.join(', ')})
                              {constraint.referencedTable && ` → ${constraint.referencedTable}(${constraint.referencedColumns?.join(', ')})`}
                            </code>
                          </div>
                        ))}
                        {parseConstraints(objectDetails?.columns || []).length === 0 && (
                          <p className="text-sm text-app-text-dim italic">No constraints defined</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'indexes' && (
                    <div>
                      <h3 className="text-sm font-semibold text-app-text-dim mb-3 uppercase tracking-wide">Indexes</h3>
                      {objectDetails?.indexes && objectDetails.indexes.length > 0 ? (
                        <div className="space-y-3">
                          {objectDetails.indexes.map((index: any, i: number) => (
                            <div key={i} className="bg-app-sidebar border border-app-border rounded p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-sm">{index.name}</span>
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                                  INDEX
                                </span>
                              </div>
                              {index.sql && (
                                <pre className="text-xs text-app-text-dim font-mono bg-app-bg p-2 rounded overflow-x-auto">
                                  {index.sql}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-app-text-dim italic">No indexes defined</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'sql' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-app-text-dim uppercase tracking-wide">SQL Definition</h3>
                        <button
                          onClick={copySQLToClipboard}
                          className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </button>
                      </div>
                      <div className="bg-app-bg border border-app-border rounded overflow-hidden">
                        <pre className="p-4 text-sm font-mono overflow-x-auto">
                          {objectDetails?.sql || 'No SQL definition available'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Content for Views, Indexes, Triggers */}
            {selectedObject.type !== 'table' && (
              <div className="flex-1 overflow-auto p-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-app-text-dim uppercase tracking-wide">Definition</h3>
                    <button
                      onClick={copySQLToClipboard}
                      className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  </div>
                  <div className="bg-app-bg border border-app-border rounded overflow-hidden">
                    <pre className="p-4 text-sm font-mono overflow-x-auto">
                      {objectDetails?.sql || 'No definition available'}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
