'use client'

import { Circle, ChevronDown } from 'lucide-react'

interface TopBarProps {
  projectInfo: any
  showCompare?: boolean
  onCompareToggle?: (enabled: boolean) => void
  showBranch?: boolean
  currentBranch?: string
  onBranchChange?: (branch: string) => void
  showAI?: boolean
  onAIClick?: () => void
}

export default function TopBar({ 
  projectInfo,
  showCompare = false,
  onCompareToggle,
  showBranch = false,
  currentBranch = 'main',
  onBranchChange,
  showAI = false,
  onAIClick
}: TopBarProps) {
  if (!projectInfo) return null

  return (
    <div className="h-12 bg-app-sidebar border-b border-app-border px-4 flex items-center justify-between">
      {/* Left: Project Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Circle className="w-2 h-2 text-app-accent fill-app-accent" />
          <span className="font-semibold text-base">{projectInfo.name}</span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-4">
        {/* Compare Toggle */}
        {showCompare && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-app-text-dim">Compare</span>
            <button
              onClick={() => onCompareToggle?.(!projectInfo.compareMode)}
              className={`
                relative w-10 h-5 rounded-full transition-colors
                ${projectInfo.compareMode ? 'bg-app-accent' : 'bg-app-border'}
              `}
            >
              <div className={`
                absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform
                ${projectInfo.compareMode ? 'left-5' : 'left-0.5'}
              `} />
            </button>
          </div>
        )}

        {/* Branch Selector */}
        {showBranch && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-app-text-dim">Branch</span>
            <button className="flex items-center gap-1 px-3 py-1 bg-app-sidebar-active rounded text-sm hover:bg-app-sidebar-hover transition-colors">
              <span>{currentBranch}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* AI Button */}
        {showAI && (
          <button
            onClick={onAIClick}
            className="px-3 py-1 bg-app-sidebar-active rounded text-sm hover:bg-app-sidebar-hover transition-colors"
          >
            AI
          </button>
        )}
      </div>
    </div>
  )
}