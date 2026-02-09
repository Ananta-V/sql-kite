'use client'

import { useEffect, useState } from 'react'
import { Clock, Code, Database, Camera, AlertCircle, GitBranch, Loader, ChevronDown, ChevronRight } from 'lucide-react'
import { getTimeline, getProjectInfo } from '@/lib/api'
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns'

type FilterType = 'all' | 'migrations' | 'sql' | 'snapshots' | 'branches'

interface TimelineEvent {
  id: number
  type: string
  branch: string
  data: any
  createdAt: string
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentBranch, setCurrentBranch] = useState('main')
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    loadProjectInfo()
  }, [])

  useEffect(() => {
    loadTimeline()
  }, [filter])

  async function loadProjectInfo() {
    try {
      const info = await getProjectInfo()
      setCurrentBranch(info.currentBranch || 'main')
    } catch (error) {
      console.error('Failed to load project info:', error)
    }
  }

  async function loadTimeline() {
    try {
      setLoading(true)
      const data = await getTimeline(100, 0, false)
      setEvents(data.events || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Failed to load timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter events
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true
    if (filter === 'migrations') return event.type.includes('migration')
    if (filter === 'sql') return event.type.includes('sql') || event.type.includes('table')
    if (filter === 'snapshots') return event.type.includes('snapshot')
    if (filter === 'branches') return event.type.includes('branch')
    return true
  })

  // Group by time
  const groupedEvents = groupEventsByTime(filteredEvents)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-app-accent" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-app-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Timeline</h1>
            <p className="text-sm text-app-text-dim">
              Database activity history • Branch: <span className="text-app-accent font-medium">{currentBranch}</span>
            </p>
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="px-3 py-2 bg-app-sidebar border border-app-border rounded text-sm appearance-none pr-8 cursor-pointer hover:border-app-border-hover transition-colors focus:outline-none focus:border-app-accent"
            >
              <option value="all">All</option>
              <option value="migrations">Migrations</option>
              <option value="sql">SQL</option>
              <option value="snapshots">Snapshots</option>
              <option value="branches">Branches</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-app-text-dim pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-app-text-dim">
            <Clock className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg">No events yet</p>
            <p className="text-sm mt-1">Activity will appear here as you use LocalDB</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {Object.entries(groupedEvents).map(([timeGroup, groupEvents]) => (
              <div key={timeGroup}>
                {/* Time Group Header */}
                <div className="text-xs font-semibold text-app-text-dim uppercase mb-3">
                  {timeGroup}
                </div>

                {/* Events in Group */}
                <div className="space-y-2">
                  {groupEvents.map((event) => (
                    <TimelineEventRow
                      key={event.id}
                      event={event}
                      currentBranch={currentBranch}
                      expanded={expandedEvent === event.id}
                      onToggleExpand={() => setExpandedEvent(
                        expandedEvent === event.id ? null : event.id
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function groupEventsByTime(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {}

  events.forEach(event => {
    const date = new Date(event.createdAt)
    let groupKey: string

    if (isToday(date)) {
      groupKey = 'Today'
    } else if (isYesterday(date)) {
      groupKey = 'Yesterday'
    } else {
      groupKey = format(date, 'MMMM d, yyyy')
    }

    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(event)
  })

  return groups
}

function TimelineEventRow({
  event,
  currentBranch,
  expanded,
  onToggleExpand
}: {
  event: TimelineEvent
  currentBranch: string
  expanded: boolean
  onToggleExpand: () => void
}) {
  const icon = getEventIcon(event.type)
  const color = getEventColor(event.type)
  const hasDetails = shouldShowDetails(event.type)

  return (
    <div className="bg-app-sidebar border border-app-border rounded-lg overflow-hidden hover:border-app-border-hover transition-colors">
      {/* Event Row */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{formatEventType(event.type)}</h3>
                {event.branch && (
                  <span
                    className={`
                      px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1
                      ${event.branch === currentBranch
                        ? 'bg-app-accent/20 text-app-accent'
                        : 'bg-app-sidebar-active text-app-text-dim'
                      }
                    `}
                  >
                    <GitBranch className="w-3 h-3" />
                    {event.branch}
                  </span>
                )}
              </div>
              <span className="text-xs text-app-text-dim whitespace-nowrap">
                {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Short Summary */}
            <EventSummary event={event} />
          </div>

          {/* Expand Button */}
          {hasDetails && (
            <button
              onClick={onToggleExpand}
              className="flex-shrink-0 text-app-text-dim hover:text-app-text transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && hasDetails && (
        <div className="border-t border-app-border px-4 py-4 bg-app-bg/50">
          <EventDetails event={event} />
        </div>
      )}
    </div>
  )
}

function EventSummary({ event }: { event: TimelineEvent }) {
  const { type, data } = event

  switch (type) {
    case 'migration_applied':
    case 'migration_created':
      return (
        <div className="text-sm text-app-text-dim">
          <span className="font-mono text-app-accent">{data.filename || data.name}</span>
        </div>
      )

    case 'migration_failed':
      return (
        <div className="text-sm text-red-400">
          <span className="font-mono">{data.filename}</span> • Failed
        </div>
      )

    case 'sql_executed':
      return (
        <div className="text-sm text-app-text-dim font-mono truncate">
          {data.sql?.split('\n')[0] || 'SQL query'}
        </div>
      )

    case 'sql_error':
      return (
        <div className="text-sm text-red-400 font-mono truncate">
          {data.sql?.split('\n')[0] || 'SQL query'} • Error
        </div>
      )

    case 'snapshot_created':
      return (
        <div className="text-sm text-app-text-dim">
          <span className="font-mono text-app-accent">{data.name || data.filename}</span>
          {data.size && <span className="ml-2 text-xs">({(data.size / 1024).toFixed(2)} KB)</span>}
        </div>
      )

    case 'snapshot_restored':
      return (
        <div className="text-sm text-app-text-dim">
          Restored from <span className="font-mono text-app-accent">{data.filename}</span>
        </div>
      )

    case 'branch_created':
      return (
        <div className="text-sm text-app-text-dim">
          Created from <span className="font-mono text-app-accent">{data.base_branch}</span>
        </div>
      )

    case 'branch_created_from_here':
      return (
        <div className="text-sm text-app-text-dim">
          Branch <span className="font-mono text-app-accent">{data.new_branch}</span> created from this branch
        </div>
      )

    case 'branch_deleted':
      return (
        <div className="text-sm text-app-text-dim">
          Deleted <span className="font-mono text-red-400">{data.branch}</span>
        </div>
      )

    case 'branch_promoted':
      return (
        <div className="text-sm text-app-text-dim">
          Promoted from <span className="font-mono text-app-accent">{data.source}</span>
        </div>
      )

    case 'branch_promoted_from_here':
      return (
        <div className="text-sm text-app-text-dim">
          Promoted to <span className="font-mono text-app-accent">{data.target}</span>
        </div>
      )

    case 'branch_switched':
      return (
        <div className="text-sm text-app-text-dim">
          Switched to <span className="font-mono text-app-accent">{data.to}</span>
          {data.from && <span> from {data.from}</span>}
        </div>
      )

    case 'table_created':
    case 'table_dropped':
      return (
        <div className="text-sm text-app-text-dim">
          {data.tableName && <span className="font-mono text-app-accent">{data.tableName}</span>}
        </div>
      )

    default:
      return <div className="text-sm text-app-text-dim">Activity recorded</div>
  }
}

function EventDetails({ event }: { event: TimelineEvent }) {
  const { type, data } = event

  switch (type) {
    case 'sql_executed':
      return (
        <div className="space-y-2">
          <pre className="text-xs bg-app-bg border border-app-border rounded p-3 overflow-x-auto font-mono max-h-60 overflow-y-auto">
            {data.sql}
          </pre>
          <div className="flex gap-4 text-xs text-app-text-dim">
            <span>Type: {data.type}</span>
            <span>Time: {data.executionTime}ms</span>
            {data.changes && <span>Changes: {data.changes}</span>}
            {data.rowCount !== undefined && <span>Rows: {data.rowCount}</span>}
          </div>
        </div>
      )

    case 'sql_error':
      return (
        <div className="space-y-2">
          <pre className="text-xs bg-app-bg border border-app-border rounded p-3 overflow-x-auto font-mono max-h-40 overflow-y-auto">
            {data.sql}
          </pre>
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
            {data.error}
          </div>
        </div>
      )

    case 'migration_applied':
    case 'migration_created':
    case 'migration_failed':
      return (
        <div className="space-y-2">
          <div className="text-xs text-app-text-dim">
            Migration: <span className="font-mono text-app-accent">{data.filename || data.name}</span>
          </div>
          {data.error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
              {data.error}
            </div>
          )}
        </div>
      )

    case 'snapshot_created':
      return (
        <div className="space-y-2">
          <div className="text-xs text-app-text-dim space-y-1">
            <div>Snapshot: <span className="font-mono text-app-accent">{data.name || data.filename}</span></div>
            {data.size && <div>Size: {(data.size / 1024).toFixed(2)} KB</div>}
            {data.description && <div>Description: {data.description}</div>}
          </div>
        </div>
      )

    case 'snapshot_restored':
      return (
        <div className="space-y-2">
          <div className="text-xs text-app-text-dim">
            Restored from: <span className="font-mono text-app-accent">{data.filename}</span>
          </div>
          <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
            ⚠ Database state was reset to this snapshot
          </div>
        </div>
      )

    case 'branch_created':
      return (
        <div className="space-y-2">
          <div className="text-xs text-app-text-dim space-y-1">
            <div>Base Branch: <span className="font-mono text-app-accent">{data.base_branch}</span></div>
            <div>Created: {new Date(data.created_at).toLocaleString()}</div>
          </div>
          <div className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded p-2">
            ℹ️ This branch is a full isolated copy of {data.base_branch}
          </div>
        </div>
      )

    case 'branch_created_from_here':
      return (
        <div className="space-y-2">
          <div className="text-xs text-app-text-dim space-y-1">
            <div>New Branch: <span className="font-mono text-app-accent">{data.new_branch}</span></div>
            <div>Created: {new Date(data.created_at).toLocaleString()}</div>
          </div>
        </div>
      )

    case 'branch_deleted':
      return (
        <div className="text-xs text-app-text-dim">
          Branch <span className="font-mono text-red-400">{data.branch}</span> was deleted
        </div>
      )

    case 'branch_promoted':
      return (
        <div className="space-y-2">
          <div className="text-xs text-app-text-dim space-y-1">
            <div>Source: <span className="font-mono text-app-accent">{data.source}</span></div>
            <div>Target: <span className="font-mono text-app-accent">{data.target}</span></div>
            <div>Promoted: {new Date(data.promoted_at).toLocaleString()}</div>
            {data.snapshot_id && <div>Snapshot ID: {data.snapshot_id}</div>}
          </div>
          <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded p-2">
            ✓ This branch state was replaced with {data.source}
          </div>
        </div>
      )

    case 'branch_promoted_from_here':
      return (
        <div className="space-y-2">
          <div className="text-xs text-app-text-dim space-y-1">
            <div>Target: <span className="font-mono text-app-accent">{data.target}</span></div>
            <div>Promoted: {new Date(data.promoted_at).toLocaleString()}</div>
          </div>
          <div className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded p-2">
            ℹ️ This branch state was promoted to {data.target}
          </div>
        </div>
      )

    case 'branch_switched':
      return (
        <div className="text-xs text-app-text-dim">
          Switched from <span className="font-mono">{data.from}</span> to <span className="font-mono text-app-accent">{data.to}</span>
        </div>
      )

    case 'table_created':
      return (
        <pre className="text-xs bg-app-bg border border-app-border rounded p-3 overflow-x-auto font-mono max-h-60 overflow-y-auto">
          {data.sql}
        </pre>
      )

    default:
      return (
        <pre className="text-xs text-app-text-dim">
          {JSON.stringify(data, null, 2)}
        </pre>
      )
  }
}

function getEventIcon(type: string) {
  switch (type) {
    case 'sql_executed':
    case 'sql_error':
      return <Code className="w-5 h-5" />
    case 'table_created':
    case 'table_dropped':
      return <Database className="w-5 h-5" />
    case 'snapshot_created':
    case 'snapshot_restored':
      return <Camera className="w-5 h-5" />
    case 'migration_applied':
    case 'migration_created':
    case 'migration_failed':
      return <Clock className="w-5 h-5" />
    case 'branch_created':
    case 'branch_created_from_here':
    case 'branch_deleted':
    case 'branch_switched':
    case 'branch_promoted':
    case 'branch_promoted_from_here':
      return <GitBranch className="w-5 h-5" />
    default:
      return <AlertCircle className="w-5 h-5" />
  }
}

function getEventColor(type: string) {
  switch (type) {
    case 'sql_executed':
      return 'bg-green-500/20 text-green-400'
    case 'sql_error':
    case 'migration_failed':
      return 'bg-red-500/20 text-red-400'
    case 'table_created':
      return 'bg-blue-500/20 text-blue-400'
    case 'table_dropped':
      return 'bg-orange-500/20 text-orange-400'
    case 'snapshot_created':
    case 'snapshot_restored':
      return 'bg-purple-500/20 text-purple-400'
    case 'migration_applied':
    case 'migration_created':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'branch_created':
    case 'branch_created_from_here':
      return 'bg-cyan-500/20 text-cyan-400'
    case 'branch_promoted':
    case 'branch_promoted_from_here':
      return 'bg-green-500/20 text-green-400'
    case 'branch_switched':
      return 'bg-indigo-500/20 text-indigo-400'
    case 'branch_deleted':
      return 'bg-red-500/20 text-red-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

function formatEventType(type: string): string {
  return type.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

function shouldShowDetails(type: string): boolean {
  // Events that have expandable details
  return ['sql_executed', 'sql_error', 'migration_applied', 'migration_created', 'migration_failed',
    'snapshot_created', 'snapshot_restored', 'branch_created', 'branch_created_from_here', 
    'branch_deleted', 'branch_promoted', 'branch_promoted_from_here', 'table_created'].includes(type)
}
