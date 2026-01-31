'use client'

import { Circle } from 'lucide-react'

interface TopBarProps {
  projectInfo: any
}

export default function TopBar({ projectInfo }: TopBarProps) {
  if (!projectInfo) return null

  return (
    <div className="h-14 bg-studio-sidebar border-b border-studio-border px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Circle className="w-3 h-3 text-studio-accent fill-studio-accent" />
          <span className="font-semibold text-lg">{projectInfo.name}</span>
        </div>
        
        <div className="h-4 w-px bg-studio-border" />
        
        <span className="text-sm text-studio-text-dim">
          Port {projectInfo.port}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-studio-text-dim">
          {projectInfo.path}
        </span>
      </div>
    </div>
  )
}