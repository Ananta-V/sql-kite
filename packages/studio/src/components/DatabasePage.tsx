'use client'

import { useEffect, useState } from 'react'
import { Table2, Plus } from 'lucide-react'
import InnerSidebar from './InnerSidebar'
import { getTables, getTableInfo, getTableData } from '@/lib/api'

export default function DatabasePage() {
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

  // Prepare sidebar data
  const sidebarSections = [
    {
      id: 'tables',
      label: 'Tables',
      items: tables.map(table => ({
        id: table.name,
        label: table.name,
        icon: <Table2 className="w-3 h-3" />,
        active: selectedTable === table.name
      }))
    }
  ]

  return (
    <div className="flex h-full">
      {/* Inner Sidebar */}
      <InnerSidebar 
        sections={sidebarSections}
        onItemClick={(_, tableId) => setSelectedTable(tableId)}
        width="220px"
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {!selectedTable ? (
          <div className="flex items-center justify-center h-full text-app-text-dim">
            <div className="text-center">
              <Table2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a table to view details</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-app-text-dim">Loading...</div>
          </div>
        ) : (
          <div className="p-6">
            {/* Table details content - same as before */}
            <h1 className="text-2xl font-bold mb-1">{selectedTable}</h1>
            <p className="text-app-text-dim text-sm mb-6">
              {tableInfo?.rowCount || 0} rows
            </p>

            {/* Schema section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Schema</h2>
              <div className="bg-app-panel border border-app-panel-border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-app-sidebar-active">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Column</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Constraints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableInfo?.columns.map((col: any, i: number) => (
                      <tr key={i} className="border-t border-app-panel-border">
                        <td className="px-4 py-3 font-mono">{col.name}</td>
                        <td className="px-4 py-3 text-app-text-dim">{col.type}</td>
                        <td className="px-4 py-3">
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

            {/* Data preview */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Data</h2>
              {tableData?.data.length === 0 ? (
                <div className="bg-app-panel border border-app-panel-border rounded p-8 text-center text-app-text-dim">
                  No rows yet
                </div>
              ) : (
                <div className="bg-app-panel border border-app-panel-border rounded overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-app-sidebar-active">
                      <tr>
                        {tableInfo?.columns.map((col: any) => (
                          <th key={col.name} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData?.data.map((row: any, i: number) => (
                        <tr key={i} className="border-t border-app-panel-border hover:bg-app-sidebar-hover">
                          {tableInfo?.columns.map((col: any) => (
                            <td key={col.name} className="px-4 py-3 font-mono">
                              {row[col.name] === null ? (
                                <span className="text-app-text-dim italic">NULL</span>
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