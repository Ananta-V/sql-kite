'use client'

import { useEffect, useState } from 'react'
import { Clock, Code, Database, Camera, AlertCircle } from 'lucide-react'
import { getTimeline } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function TimelinePage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTimeline()
  }, [])

  async function loadTimeline() {
    try {
      const data = await getTimeline(100, 0)
      setEvents(data.events)
    } catch (error) {
      console.error('Failed to load timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-studio-text-dim">Loading timeline...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Timeline</h1>

      {events.length === 0 ? (
        <div className="bg-studio-sidebar border border-studio-border rounded-lg p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-studio-text-dim opacity-50" />
          <p className="text-studio-text-dim">No events yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <TimelineEvent key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

function TimelineEvent({ event }: { event: any }) {
  const icon = getEventIcon(event.type)
  const color = getEventColor(event.type)

  return (
    <div className="bg-studio-sidebar border border-studio-border rounded-lg p-4 hover:border-studio-hover transition-colors">
      <div className="flex gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="font-semibold">{formatEventType(event.type)}</h3>
            <span className="text-xs text-studio-text-dim whitespace-nowrap">
              {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
            </span>
          </div>

          <EventDetails type={event.type} data={event.data} />
        </div>
      </div>
    </div>
  )
}

function EventDetails({ type, data }: { type: string; data: any }) {
  switch (type) {
    case 'sql_executed':
      return (
        <div className="space-y-2">
          <pre className="text-sm bg-studio-bg border border-studio-border rounded p-3 overflow-x-auto font-mono">
            {data.sql}
          </pre>
          <div className="flex gap-4 text-xs text-studio-text-dim">
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
          <pre className="text-sm bg-studio-bg border border-studio-border rounded p-3 overflow-x-auto font-mono">
            {data.sql}
          </pre>
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
            {data.error}
          </div>
        </div>
      )

    case 'migration_applied':
      return (
        <div className="text-sm text-studio-text-dim">
          Applied migration: <span className="font-mono">{data.filename}</span>
        </div>
      )

    case 'snapshot_created':
      return (
        <div className="text-sm text-studio-text-dim">
          Created snapshot: <span className="font-mono">{data.filename}</span>
          <span className="ml-2">({(data.size / 1024).toFixed(2)} KB)</span>
        </div>
      )

    case 'snapshot_restored':
      return (
        <div className="text-sm text-studio-text-dim">
          Restored from: <span className="font-mono">{data.filename}</span>
        </div>
      )

    case 'table_created':
      return (
        <pre className="text-sm bg-studio-bg border border-studio-border rounded p-3 overflow-x-auto font-mono">
          {data.sql}
        </pre>
      )

    case 'table_dropped':
      return (
        <div className="text-sm text-studio-text-dim">
          Dropped table: <span className="font-mono">{data.tableName}</span>
        </div>
      )

    default:
      return (
        <pre className="text-sm text-studio-text-dim">
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
      return <Clock className="w-5 h-5" />
    default:
      return <AlertCircle className="w-5 h-5" />
  }
}

function getEventColor(type: string) {
  switch (type) {
    case 'sql_executed':
      return 'bg-green-500/20 text-green-400'
    case 'sql_error':
      return 'bg-red-500/20 text-red-400'
    case 'table_created':
      return 'bg-blue-500/20 text-blue-400'
    case 'table_dropped':
      return 'bg-orange-500/20 text-orange-400'
    case 'snapshot_created':
    case 'snapshot_restored':
      return 'bg-purple-500/20 text-purple-400'
    case 'migration_applied':
      return 'bg-yellow-500/20 text-yellow-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

function formatEventType(type: string): string {
  return type.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}