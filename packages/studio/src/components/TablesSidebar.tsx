'use client'

import { Table2 } from 'lucide-react'

interface TablesSidebarProps {
  tables: any[]
  selectedTable: string | null
  onTableSelect: (tableName: string) => void
  width?: string
}

export default function TablesSidebar({
  tables,
  selectedTable,
  onTableSelect,
  width = '220px'
}: TablesSidebarProps) {
  return (
    <div
      className="bg-app-sidebar border-r border-app-border overflow-y-auto flex-shrink-0"
      style={{ width }}
    >
      <div className="p-2">
        <div className="px-2 py-1.5 mb-2">
          <div className="flex items-center gap-2 text-xs text-app-text-dim">
            <Table2 className="w-3.5 h-3.5" />
            <span className="font-medium uppercase tracking-wide">Tables</span>
          </div>
        </div>

        <div className="space-y-0.5">
          {tables.length === 0 ? (
            <div className="px-2 py-4 text-xs text-app-text-dim text-center">
              No tables yet
            </div>
          ) : (
            tables.map((table) => (
              <button
                key={table.name}
                onClick={() => onTableSelect(table.name)}
                className={`
                  w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded
                  transition-colors text-left
                  ${selectedTable === table.name
                    ? 'bg-app-sidebar-active text-app-text'
                    : 'text-app-text-dim hover:bg-app-sidebar-hover hover:text-app-text'
                  }
                `}
              >
                <Table2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{table.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
