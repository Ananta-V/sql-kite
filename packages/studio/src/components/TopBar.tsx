'use client'

import { Circle } from 'lucide-react'
import BranchSelector from './BranchSelector'

interface TopBarProps {
  projectInfo: any
  currentBranch?: string
  onBranchChange?: () => void
  onCreateBranchClick?: () => void
  showAI?: boolean
  onAIClick?: () => void
  disableBranchSelector?: boolean
}

export default function TopBar({
  projectInfo,
  currentBranch,
  onBranchChange,
  onCreateBranchClick,
  showAI = false,
  onAIClick,
  disableBranchSelector = false
}: TopBarProps) {
  if (!projectInfo) return null

  const branchToShow = currentBranch || projectInfo.currentBranch || 'main'

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
      <div className="flex items-center gap-3">
        {/* Branch Selector - Always visible */}
        <BranchSelector
          currentBranch={branchToShow}
          onBranchChange={onBranchChange}
          onCreateClick={onCreateBranchClick}
          disabled={disableBranchSelector}
        />

        {/* AI Button - Only on SQL editor */}
        {showAI && (
          <button
            onClick={onAIClick}
            className="px-3 py-1.5 bg-app-sidebar-active rounded text-sm hover:bg-app-sidebar-hover transition-colors"
          >
            AI
          </button>
        )}
      </div>
    </div>
  )
}
