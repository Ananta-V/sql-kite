'use client'

import { useState, useEffect, useRef } from 'react'
import { GitBranch, ChevronDown, Check, Plus, Loader, Lock } from 'lucide-react'
import { getBranches, switchBranch } from '@/lib/api'

interface Branch {
  name: string
  is_current: boolean
  db_file: string
  created_at: string
  description?: string
}

interface BranchSelectorProps {
  currentBranch: string
  onBranchChange?: () => void
  onCreateClick?: () => void
  disabled?: boolean
}

export default function BranchSelector({
  currentBranch,
  onBranchChange,
  onCreateClick,
  disabled = false
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadBranches()
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  async function loadBranches() {
    try {
      setLoading(true)
      const data = await getBranches()
      setBranches(data.branches || [])
    } catch (error) {
      console.error('Failed to load branches:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSwitch(branchName: string) {
    if (branchName === currentBranch || switching) return

    try {
      setSwitching(true)
      await switchBranch(branchName)
      setIsOpen(false)

      // Just call onBranchChange without reloading the page
      onBranchChange?.()
    } catch (error) {
      console.error('Failed to switch branch:', error)
      alert(`Failed to switch branch: ${error}`)
    } finally {
      setSwitching(false)
    }
  }

  function handleCreateClick() {
    setIsOpen(false)
    onCreateClick?.()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen)
        }}
        className={`px-3 py-1.5 bg-app-sidebar border border-app-border rounded transition-colors flex items-center gap-2 text-sm ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-app-border-hover'}`}
        title={disabled ? 'Disabled in Compare Mode' : undefined}
        disabled={disabled}
      >
        <GitBranch className="w-4 h-4" />
        <span className="font-medium">{currentBranch}</span>
        {disabled && <Lock className="w-3.5 h-3.5 text-app-text-dim" />}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-app-sidebar border border-app-border rounded-lg shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="px-3 py-2 border-b border-app-border bg-app-bg">
            <p className="text-xs font-semibold text-app-text-dim uppercase">Switch Branch</p>
          </div>

          {/* Branches List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-8 flex items-center justify-center">
                <Loader className="w-5 h-5 animate-spin text-app-accent" />
              </div>
            ) : branches.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-app-text-dim">
                No branches found
              </div>
            ) : (
              branches.map((branch) => (
                <button
                  key={branch.name}
                  onClick={() => handleSwitch(branch.name)}
                  disabled={switching || branch.name === currentBranch}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-app-sidebar-hover transition-colors flex items-center justify-between gap-2
                    ${branch.name === currentBranch ? 'bg-app-sidebar-active' : ''}
                    ${switching ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 flex-shrink-0 text-app-text-dim" />
                      <span className="font-medium truncate">{branch.name}</span>
                    </div>
                    {branch.description && (
                      <p className="text-xs text-app-text-dim mt-0.5 truncate">
                        {branch.description}
                      </p>
                    )}
                  </div>
                  {branch.name === currentBranch && (
                    <Check className="w-4 h-4 text-app-accent flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Create New Branch Button */}
          <div className="border-t border-app-border">
            <button
              onClick={handleCreateClick}
              className="w-full px-3 py-2 text-left hover:bg-app-sidebar-hover transition-colors flex items-center gap-2 text-sm font-medium text-app-accent"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Branch</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
