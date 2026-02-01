'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface InnerSidebarSection {
  id: string
  label: string
  icon?: React.ReactNode
  items: InnerSidebarItem[]
  collapsed?: boolean
}

interface InnerSidebarItem {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: string
  active?: boolean
}

interface InnerSidebarProps {
  sections: InnerSidebarSection[]
  onItemClick?: (sectionId: string, itemId: string) => void
  width?: string
}

export default function InnerSidebar({ 
  sections: initialSections, 
  onItemClick,
  width = '240px' 
}: InnerSidebarProps) {
  const [sections, setSections] = useState(initialSections)

  const toggleSection = (sectionId: string) => {
    setSections(sections.map(section => 
      section.id === sectionId 
        ? { ...section, collapsed: !section.collapsed }
        : section
    ))
  }

  return (
    <div 
      className="bg-app-sidebar border-r border-app-border overflow-y-auto flex-shrink-0"
      style={{ width }}
    >
      <div className="p-2">
        {sections.map((section) => (
          <div key={section.id} className="mb-2">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-app-text-dim hover:text-app-text transition-colors rounded"
            >
              <div className="flex items-center gap-2">
                {section.collapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span className="font-medium uppercase tracking-wide">
                  {section.label}
                </span>
              </div>
            </button>

            {/* Section Items */}
            {!section.collapsed && (
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onItemClick?.(section.id, item.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5 text-sm rounded
                      transition-colors
                      ${item.active
                        ? 'bg-app-sidebar-active text-app-text'
                        : 'text-app-text-dim hover:bg-app-sidebar-hover hover:text-app-text'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-xs bg-app-border px-1.5 py-0.5 rounded">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}