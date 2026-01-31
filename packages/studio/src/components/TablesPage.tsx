'use client'

import { useEffect, useState } from 'react'
import { Table2, Plus, Trash2, Eye } from 'lucide-react'
import { getTables, getTableInfo, getTableData, dropTable } from '@/lib/api'

export default function TablesPage() {
  const [tables, setTables] = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableInfo, setTableInfo] = useState<any>(null)
  const [tableData, setTableData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTables()
  }, [])

  useEffect(() => {
    if (selectedTable) {
      loadTableDetails(selectedTable)
    }
  }, [selectedTable])

  async function loadTables() {
    try {
      const data = await getTables()
      setTables(data)
      if (data.length > 0 && !selectedTable) {
        setSelectedTable(data[0].name)
      }
    } catch (error) {
      console.error('Failed to load tables:', error)
    }
  }

  async function loadTableDetails(tableName: string) {
    setLoading(true)
    try {
      const [info, data] = await Promise.all([
        getTableInfo(tableName),
        getTableData(tableName, 100, 0)
      ])
      setTableInfo(info)
      setTableData(data)
    } catch (error) {
      console.error('Failed to load table details:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDropTable(tableName: string) {
    if (!confirm(`Are you sure you want to drop table "${tableName}"?`)) {
      return
    }

    try {
      await dropTable(tableName)
      await loadTables()
      setSelectedTable(null)
      setTableInfo(null)
      setTableData(null)
    } catch (error) {
      alert('Failed to drop table: ' + error)
    }
  }

  return (
    <div className="flex h-full">
      {/* Tables List */}
      <div className="w-64 bg-studio-sidebar border-r border-studio-border overflow-y-auto">
        <div className="p-4 border-b border-studio-border">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-studio-accent hover:bg-studio-accent-hover text-white rounded-lg font-medium transition-colors">
            <Plus className="w-4 h-4" />
            New Table
          </button>
        </div>

        <div className="p-3">
          {tables.length === 0 ? (
            <p className="text-studio-text-dim text-sm text-center py-8">
              No tables yet
            </p>
          ) : (
            <div className="space-y-1">
              {tables.map(table => (
                <button
                  key={table.name}
                  onClick={() => setSelectedTable(table.name)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-lg
                    transition-colors text-left
                    ${selectedTable === table.name
                      ? 'bg-studio-active text-studio-accent'
                      : 'text-studio-text-dim hover:bg-studio-hover hover:text-studio-text'
                    }
                  `}
                >
                  <Table2 className="w-4 h-4" />
                  <span className="font-mono text-sm truncate">{table.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table Details */}
      <div className="flex-1 overflow-auto">
        {!selectedTable ? (
          <div className="flex items-center justify-center h-full text-studio-text-dim">
            <div className="text-center">
              <Table2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a table to view details</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-studio-text-dim">Loading...</div>
          </div>
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold mb-1">{selectedTable}</h1>
                <p className="text-studio-text-dim text-sm">
                  {tableInfo?.rowCount || 0} rows
                </p>
              </div>
              <button
                onClick={() => handleDropTable(selectedTable)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Drop Table
              </button>
            </div>

            {/* Schema */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Schema</h2>
              <div className="bg-studio-sidebar border border-studio-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-studio-hover">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Column</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Constraints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableInfo?.columns.map((col: any, i: number) => (
                      <tr key={i} className="border-t border-studio-border">
                        <td className="px-4 py-3 font-mono text-sm">{col.name}</td>
                        <td className="px-4 py-3 text-sm text-studio-text-dim">{col.type}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            {col.primaryKey && (
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                                PK
                              </span>
                            )}
                            {col.notNull && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                                NOT NULL
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Data Preview */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Data Preview</h2>
              {tableData?.data.length === 0 ? (
                <div className="bg-studio-sidebar border border-studio-border rounded-lg p-8 text-center text-studio-text-dim">
                  No rows yet
                </div>
              ) : (
                <div className="bg-studio-sidebar border border-studio-border rounded-lg overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-studio-hover">
                      <tr>
                        {tableInfo?.columns.map((col: any) => (
                          <th key={col.name} className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData?.data.map((row: any, i: number) => (
                        <tr key={i} className="border-t border-studio-border hover:bg-studio-hover">
                          {tableInfo?.columns.map((col: any) => (
                            <td key={col.name} className="px-4 py-3 text-sm font-mono">
                              {row[col.name] === null ? (
                                <span className="text-studio-text-dim italic">NULL</span>
                              ) : (
                                String(row[col.name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}