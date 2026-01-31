'use client'

import { Home, Table2, Code, Clock, Camera, Settings, Database } from 'lucide-react'

type Page = 'home' | 'tables' | 'sql' | 'timeline' | 'snapshots'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const menuItems = [
    { id: 'home' as Page, icon: Home, label: 'Home' },
    { id: 'tables' as Page, icon: Table2, label: 'Tables' },
    { id: 'sql' as Page, icon: Code, label: 'SQL Editor' },
    { id: 'timeline' as Page, icon: Clock, label: 'Timeline' },
    { id: 'snapshots' as Page, icon: Camera, label: 'Snapshots' },
  ]

  return (
    <div className="w-64 bg-studio-sidebar border-r border-studio-border flex flex-col">
      <div className="p-4 border-b border-studio-border">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-studio-accent" />
          <span className="font-semibold text-lg">LocalDB Studio</span>
        </div>
      </div>

      <nav className="flex-1 p-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-colors duration-150
                  ${isActive 
                    ? 'bg-studio-active text-studio-accent' 
                    : 'text-studio-text-dim hover:bg-studio-hover hover:text-studio-text'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="p-3 border-t border-studio-border">
        <div className="text-xs text-studio-text-dim">
          <div>LocalDB v1.0.0</div>
          <div className="mt-1">SQLite 3.44.0</div>
        </div>
      </div>
    </div>
  )
}