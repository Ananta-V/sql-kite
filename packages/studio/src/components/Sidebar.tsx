'use client'

import { Home, Code, Database, Camera, Clock, Settings, Menu, GitBranch } from 'lucide-react'
import { useState } from 'react'

type Page = 'home' | 'sql' | 'database' | 'migrations' | 'snapshots' | 'timeline' | 'settings'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = [
    { id: 'home' as Page, icon: Home, label: 'Dashboard' },
    { id: 'sql' as Page, icon: Code, label: 'SQL Editor' },
    { id: 'database' as Page, icon: Database, label: 'Database' },
    { id: 'migrations' as Page, icon: GitBranch, label: 'Migrations' },
    { id: 'snapshots' as Page, icon: Camera, label: 'Snapshots' },
    { id: 'timeline' as Page, icon: Clock, label: 'Timeline' },
    { id: 'settings' as Page, icon: Settings, label: 'Settings' },
  ]

  return (
    <div className={`${collapsed ? 'w-16' : 'w-56'} bg-app-sidebar border-r border-app-border flex flex-col transition-all duration-200`}>
      {/* Header */}
      <div className="h-12 border-b border-app-border flex items-center justify-between px-4">
        {!collapsed && (
          <span className="font-semibold text-base">LocalDB</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <div className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded
                  transition-colors duration-150
                  ${isActive 
                    ? 'bg-app-sidebar-active text-app-text' 
                    : 'text-app-text-dim hover:bg-app-sidebar-hover hover:text-app-text'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-app-border">
          <div className="text-xs text-app-text-dim space-y-0.5">
            <div>LocalDB v1.0.0</div>
            <div>SQLite 3.44.0</div>
          </div>
        </div>
      )}
    </div>
  )
}