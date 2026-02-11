'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Save, Star, ChevronDown, Camera, Copy, AlertCircle, Info, FileText, Download, Database, CheckCircle, Lock, ArrowLeftRight, GitBranch, Eye, List, Terminal, X, Plus, FileCode, Folder, ChevronRight } from 'lucide-react'
import dynamic from 'next/dynamic'
import InnerSidebar from './InnerSidebar'
import { executeQuery, executeCompareQuery, checkpointCompareBranches, closeCompareBranches, getBranches, getTables, getTableInfo, createMigration, createSnapshot } from '@/lib/api'
import { useAppContext } from '@/contexts/AppContext'
import { toast } from 'react-toastify'
import {
  SQLCompletionProvider,
  SQLSignatureHelpProvider,
  SQLHoverProvider
} from '@/lib/sql-autocomplete'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface ExecutionResult {
  type: 'select' | 'insert' | 'update' | 'delete' | 'ddl'
  rows?: any[]
  changes?: number
  executionTime: number
  lastInsertId?: number
}

interface ErrorDetails {
  message: string
  code?: string
  errno?: number
  location?: { line: number; column: number }
}

interface CompareSchemaItem {
  type: string
  name: string
  sql: string
}

interface CompareColumnInfo {
  name: string
  type: string
  notnull: number
  dflt_value: any
  pk: number
}

interface CompareTableChange {
  table: string
  addedColumns: CompareColumnInfo[]
  removedColumns: CompareColumnInfo[]
  modifiedColumns: Array<{ name: string; fromType: string; toType: string }>
  rowCounts?: { a: number; b: number }
}

interface CompareChanges {
  addedTables: CompareSchemaItem[]
  removedTables: CompareSchemaItem[]
  addedIndexes: CompareSchemaItem[]
  removedIndexes: CompareSchemaItem[]
  addedTriggers: CompareSchemaItem[]
  removedTriggers: CompareSchemaItem[]
  tableChanges: CompareTableChange[]
}

interface QueryTab {
  id: string
  name: string
  sql: string
}

interface SQLEditorPageProps {
  compareMode?: boolean
  onCompareModeChange?: (next: boolean) => void
}

export default function SQLEditorPage({ compareMode = false, onCompareModeChange }: SQLEditorPageProps) {
  const { editorState, updateSQL, updateActiveTab, addFavorite, projectInfo } = useAppContext()
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [error, setError] = useState<ErrorDetails | null>(null)
  const [errorHistory, setErrorHistory] = useState<Array<{ sql: string; error: ErrorDetails; timestamp: number }>>([])
  const [loading, setLoading] = useState(false)
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [migrationName, setMigrationName] = useState('')
  const [savingMigration, setSavingMigration] = useState(false)
  const [showFavoriteModal, setShowFavoriteModal] = useState(false)
  const [favoriteName, setFavoriteName] = useState('')
  const [selectedSQL, setSelectedSQL] = useState('')
  const [showSnapshotModal, setShowSnapshotModal] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [lastQueryType, setLastQueryType] = useState<string>('unknown')
  const [lastExecutedSQL, setLastExecutedSQL] = useState<string>('')
  const [compareEnabled, setCompareEnabled] = useState(compareMode)
  const [compareTab, setCompareTab] = useState<'change' | 'preview' | 'manual'>('change')
  const [compareBranches, setCompareBranches] = useState<{ a: string; b: string }>({ a: '', b: '' })
  const [compareBranchOptions, setCompareBranchOptions] = useState<string[]>([])
  const [compareErrorMessage, setCompareErrorMessage] = useState<string | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareChanges, setCompareChanges] = useState<CompareChanges | null>(null)
  const [compareSqlPreview, setCompareSqlPreview] = useState('')
  const [compareSqlPreviewReverse, setCompareSqlPreviewReverse] = useState('')
  const [compareSqlA, setCompareSqlA] = useState('SELECT * FROM sqlite_master;')
  const [compareSqlB, setCompareSqlB] = useState('SELECT * FROM sqlite_master;')
  const [compareActiveTerminal, setCompareActiveTerminal] = useState<'a' | 'b'>('a')
  const [compareResults, setCompareResults] = useState<{ a: ExecutionResult | null; b: ExecutionResult | null }>({ a: null, b: null })
  const [compareErrors, setCompareErrors] = useState<{ a: ErrorDetails | null; b: ErrorDetails | null }>({ a: null, b: null })
  const [compareQueryTypes, setCompareQueryTypes] = useState<{ a: string; b: string }>({ a: 'SELECT', b: 'SELECT' })
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)
  const [resultHeight, setResultHeight] = useState(320)
  
  const completionProviderRef = useRef<SQLCompletionProvider | null>(null)
  const hoverProviderRef = useRef<SQLHoverProvider | null>(null)
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)

  // Query tabs state
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>(() => {
    if (typeof window === 'undefined') return [{ id: 'tab-1', name: 'Untitled query', sql: '-- Write your SQL query here\n' }]
    const saved = localStorage.getItem('localdb-query-tabs')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch (e) { /* ignore */ }
    }
    return [{ id: 'tab-1', name: 'Untitled query', sql: '-- Write your SQL query here\n' }]
  })
  const [activeQueryTabId, setActiveQueryTabId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'tab-1'
    const saved = localStorage.getItem('localdb-active-query-tab')
    return saved || 'tab-1'
  })
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)

  // Private items state
  const [privateItems, setPrivateItems] = useState<Array<{ id: string; label: string; sql?: string; type: 'file' | 'folder'; expanded?: boolean; children?: any[] }>>(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem('localdb-private')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) { /* ignore */ }
    }
    return []
  })

  // Persist private items to localStorage
  useEffect(() => {
    localStorage.setItem('localdb-private', JSON.stringify(privateItems))
  }, [privateItems])

  // Save modal state
  const [saveModal, setSaveModal] = useState<{ type: 'favorite' | 'template' | 'private'; sql: string } | null>(null)
  const [saveItemName, setSaveItemName] = useState('')
  const [selectedFolderPath, setSelectedFolderPath] = useState<string[]>([]) // Array of folder IDs for nested selection
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)

  // Persist tabs to localStorage
  useEffect(() => {
    localStorage.setItem('localdb-query-tabs', JSON.stringify(queryTabs))
  }, [queryTabs])

  useEffect(() => {
    localStorage.setItem('localdb-active-query-tab', activeQueryTabId)
  }, [activeQueryTabId])

  // Ctrl+S to open save dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        // Block save in compare mode
        if (compareEnabled) {
          toast.warning('Save is disabled in Compare Mode')
          return
        }
        const activeTab = queryTabs.find(t => t.id === activeQueryTabId)
        // Prevent saving empty queries
        if (!activeTab?.sql?.trim()) {
          toast.error('Cannot save empty query')
          return
        }
        // Show save modal with 'private' as default
        setSaveModal({ type: 'private', sql: activeTab.sql })
        setSaveItemName(activeTab.name !== 'Untitled query' ? activeTab.name : '')
        setSelectedFolderPath([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [queryTabs, activeQueryTabId, compareEnabled])

  // Close tab context menu on click outside
  useEffect(() => {
    if (!tabContextMenu) return
    const handleClick = () => setTabContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [tabContextMenu])

  // Helper to get folders at a specific level
  const getFoldersAtPath = useCallback((items: any[], pathIndex: number): any[] => {
    if (pathIndex === 0) {
      return items.filter(item => item.type === 'folder')
    }
    // Navigate to the current folder
    let currentItems = items
    for (let i = 0; i < pathIndex; i++) {
      const folderId = selectedFolderPath[i]
      const folder = currentItems.find(item => item.id === folderId && item.type === 'folder')
      if (folder && folder.children) {
        currentItems = folder.children
      } else {
        return []
      }
    }
    return currentItems.filter(item => item.type === 'folder')
  }, [selectedFolderPath])

  // Get current section items based on save type
  const getCurrentSectionItems = useCallback((type: 'favorite' | 'template' | 'private'): any[] => {
    if (type === 'private') return privateItems
    if (type === 'favorite') {
      const saved = localStorage.getItem('localdb-favorites')
      return saved ? JSON.parse(saved) : []
    }
    if (type === 'template') {
      const saved = localStorage.getItem('localdb-templates')
      return saved ? JSON.parse(saved) : []
    }
    return []
  }, [privateItems])

  // Add item to a specific folder path
  const addItemToPath = useCallback((items: any[], newItem: any, folderPath: string[]): any[] => {
    if (folderPath.length === 0) {
      return [...items, newItem]
    }

    return items.map(item => {
      if (item.id === folderPath[0] && item.type === 'folder') {
        const remainingPath = folderPath.slice(1)
        return {
          ...item,
          children: addItemToPath(item.children || [], newItem, remainingPath)
        }
      }
      return item
    })
  }, [])

  // Handle save to different sections
  const handleSaveAs = useCallback((type: 'favorite' | 'template' | 'private') => {
    if (!saveModal) return
    const name = saveItemName.trim()
    if (!name) {
      toast.error('Please enter a name')
      return
    }

    const newItem = { id: `${type.slice(0, 4)}-${Date.now()}`, label: name, sql: saveModal.sql, type: 'file' as const }

    if (type === 'favorite') {
      const saved = localStorage.getItem('localdb-favorites')
      const favorites = saved ? JSON.parse(saved) : []
      const updated = addItemToPath(favorites, newItem, selectedFolderPath)
      localStorage.setItem('localdb-favorites', JSON.stringify(updated))
      window.dispatchEvent(new Event('storage'))
    } else if (type === 'template') {
      const saved = localStorage.getItem('localdb-templates')
      const templates = saved ? JSON.parse(saved) : []
      const updated = addItemToPath(templates, newItem, selectedFolderPath)
      localStorage.setItem('localdb-templates', JSON.stringify(updated))
      window.dispatchEvent(new Event('storage'))
    } else if (type === 'private') {
      setPrivateItems(prev => addItemToPath(prev, newItem, selectedFolderPath))
    }

    // Update the current tab name if it's Untitled query
    const currentTab = queryTabs.find(t => t.id === activeQueryTabId)
    if (currentTab && currentTab.name === 'Untitled query') {
      setQueryTabs(prev => prev.map(tab => 
        tab.id === activeQueryTabId ? { ...tab, name } : tab
      ))
    }

    toast.success(`Saved to ${type}`)
    setSaveModal(null)
    setSaveItemName('')
    setSelectedFolderPath([])
  }, [saveModal, saveItemName, selectedFolderPath, addItemToPath, queryTabs, activeQueryTabId])

  // Sync current tab SQL with editor
  const activeQueryTab = queryTabs.find(t => t.id === activeQueryTabId) || queryTabs[0]

  const updateCurrentTabSQL = useCallback((sql: string) => {
    setQueryTabs(prev => prev.map(tab => 
      tab.id === activeQueryTabId ? { ...tab, sql } : tab
    ))
    updateSQL(sql)
  }, [activeQueryTabId, updateSQL])

  // When switching tabs, load the tab's SQL
  useEffect(() => {
    if (activeQueryTab) {
      updateSQL(activeQueryTab.sql)
    }
  }, [activeQueryTabId])

  // Tab operations
  const addNewTab = useCallback(() => {
    const newId = `tab-${Date.now()}`
    const newTab: QueryTab = { id: newId, name: 'Untitled query', sql: '' }
    setQueryTabs(prev => [...prev, newTab])
    setActiveQueryTabId(newId)
  }, [])

  const closeTab = useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setQueryTabs(prev => {
      if (prev.length === 1) return prev // Keep at least one tab
      const newTabs = prev.filter(t => t.id !== tabId)
      if (activeQueryTabId === tabId) {
        const idx = prev.findIndex(t => t.id === tabId)
        const newActiveIdx = Math.min(idx, newTabs.length - 1)
        setActiveQueryTabId(newTabs[newActiveIdx].id)
      }
      return newTabs
    })
  }, [activeQueryTabId])

  const startRenaming = useCallback((tabId: string, currentName: string) => {
    setRenamingTabId(tabId)
    setRenamingValue(currentName)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [])

  const finishRenaming = useCallback(() => {
    if (renamingTabId && renamingValue.trim()) {
      setQueryTabs(prev => prev.map(tab =>
        tab.id === renamingTabId ? { ...tab, name: renamingValue.trim() } : tab
      ))
    }
    setRenamingTabId(null)
    setRenamingValue('')
  }, [renamingTabId, renamingValue])

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      closeTab(tabId)
    }
  }, [closeTab])

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    if (!draggedTabId || draggedTabId === targetTabId) return
    setQueryTabs(prev => {
      const draggedIdx = prev.findIndex(t => t.id === draggedTabId)
      const targetIdx = prev.findIndex(t => t.id === targetTabId)
      if (draggedIdx === -1 || targetIdx === -1) return prev
      const newTabs = [...prev]
      const [dragged] = newTabs.splice(draggedIdx, 1)
      newTabs.splice(targetIdx, 0, dragged)
      return newTabs
    })
    setDraggedTabId(null)
  }, [draggedTabId])

  // Load table schema for autocomplete
  useEffect(() => {
    loadSchemaForAutocomplete()
  }, [])

  useEffect(() => {
    setCompareEnabled(compareMode)
  }, [compareMode])

  useEffect(() => {
    onCompareModeChange?.(compareEnabled)
  }, [compareEnabled, onCompareModeChange])

  useEffect(() => {
    if (!compareEnabled) {
      setCompareTab('change')
      setCompareChanges(null)
      setCompareSqlPreview('')
      setCompareSqlPreviewReverse('')
      setCompareErrors({ a: null, b: null })
      setCompareResults({ a: null, b: null })
      setCompareErrorMessage(null)
      setShowExportMenu(false)
      if (compareBranches.a && compareBranches.b) {
        closeCompareBranches([compareBranches.a, compareBranches.b]).catch(() => null)
      }
      return
    }

    setShowExportMenu(false)
    loadCompareBranches()
  }, [compareEnabled])

  useEffect(() => {
    if (!compareEnabled) return
    if (!compareBranches.a || !compareBranches.b || compareBranches.a === compareBranches.b) return

    checkpointCompareBranches([compareBranches.a, compareBranches.b]).catch(() => null)
  }, [compareEnabled, compareBranches])

  useEffect(() => {
    if (!compareEnabled) return
    if (compareTab !== 'change') return
    if (!compareBranches.a || !compareBranches.b || compareBranches.a === compareBranches.b) return

    loadCompareChanges()
  }, [compareEnabled, compareTab, compareBranches])

  useEffect(() => {
    if (!compareEnabled) return
    if (!compareBranches.a || !compareBranches.b) return
    if (compareBranches.a === compareBranches.b) return

    const preview = buildSqlPreview(compareChanges)
    const previewReverse = buildSqlPreviewReverse(compareChanges)
    setCompareSqlPreview(preview)
    setCompareSqlPreviewReverse(previewReverse)
  }, [compareEnabled, compareBranches, compareChanges])

  useEffect(() => {
    return () => {
      if (compareEnabled && compareBranches.a && compareBranches.b) {
        closeCompareBranches([compareBranches.a, compareBranches.b]).catch(() => null)
      }
    }
  }, [compareEnabled, compareBranches])

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  useEffect(() => {
    function handleMove(event: MouseEvent | TouchEvent) {
      if (!isResizingRef.current || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
      const maxHeight = Math.max(220, rect.height - 220)
      const nextHeight = Math.min(maxHeight, Math.max(160, rect.bottom - clientY))
      setResultHeight(nextHeight)
    }

    function stopResize() {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', stopResize)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('touchend', stopResize)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', stopResize)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', stopResize)
    }
  }, [])

  async function loadSchemaForAutocomplete() {
    try {
      const tables = await getTables()
      
      // Load detailed schema for each table
      const tableSchemas = await Promise.all(
        tables.map(async (table: any) => {
          const info = await getTableInfo(table.name)
          return {
            name: table.name,
            columns: info.columns.map((col: any) => ({
              name: col.name,
              type: col.type
            }))
          }
        })
      )

      // Update providers with schema
      if (completionProviderRef.current) {
        completionProviderRef.current.updateTables(tableSchemas)
      }
      if (hoverProviderRef.current) {
        hoverProviderRef.current.updateTables(tableSchemas)
      }
    } catch (error) {
      console.error('Failed to load schema for autocomplete:', error)
    }
  }

  async function loadCompareBranches() {
    try {
      const data = await getBranches()
      const branchNames = (data.branches || []).map((branch: any) => branch.name)
      setCompareBranchOptions(branchNames)

      const current = projectInfo?.currentBranch || data.current || branchNames[0] || ''
      const branchA = current
      const branchB = branchNames.find((name: string) => name !== branchA) || ''

      setCompareBranches({ a: branchA, b: branchB })

      if (!branchA || !branchB || branchA === branchB) {
        setCompareErrorMessage('Select two different branches to compare')
      } else {
        setCompareErrorMessage(null)
      }
    } catch (error) {
      console.error('Failed to load branches for compare mode:', error)
      setCompareErrorMessage('Failed to load branches for compare')
    }
  }

  function normalizeColumnType(type: string) {
    return (type || '').trim().toUpperCase()
  }

  function buildSqlPreview(changes: CompareChanges | null) {
    if (!changes) return ''

    const lines: string[] = []

    changes.addedTables.forEach((table) => {
      lines.push(table.sql.endsWith(';') ? table.sql : `${table.sql};`)
    })

    changes.removedTables.forEach((table) => {
      lines.push(`DROP TABLE IF EXISTS "${table.name}";`)
    })

    changes.addedIndexes.forEach((index) => {
      lines.push(index.sql.endsWith(';') ? index.sql : `${index.sql};`)
    })

    changes.removedIndexes.forEach((index) => {
      lines.push(`DROP INDEX IF EXISTS "${index.name}";`)
    })

    changes.addedTriggers.forEach((trigger) => {
      lines.push(trigger.sql.endsWith(';') ? trigger.sql : `${trigger.sql};`)
    })

    changes.removedTriggers.forEach((trigger) => {
      lines.push(`DROP TRIGGER IF EXISTS "${trigger.name}";`)
    })

    changes.tableChanges.forEach((change) => {
      change.addedColumns.forEach((column) => {
        lines.push(`ALTER TABLE "${change.table}" ADD COLUMN "${column.name}" ${column.type};`)
      })

      change.removedColumns.forEach((column) => {
        lines.push(`-- Column removed: ${change.table}.${column.name}`)
      })

      change.modifiedColumns.forEach((column) => {
        lines.push(`-- Column modified: ${change.table}.${column.name} ${column.fromType} -> ${column.toType}`)
      })
    })

    return lines.join('\n')
  }

  // Build reverse SQL: B → A (undo changes from B back to A)
  function buildSqlPreviewReverse(changes: CompareChanges | null) {
    if (!changes) return ''

    const lines: string[] = []

    // Reverse of added tables → DROP them
    changes.addedTables.forEach((table) => {
      lines.push(`DROP TABLE IF EXISTS "${table.name}";`)
    })

    // Reverse of removed tables → need CREATE (but we don't have SQL for it from B context)
    changes.removedTables.forEach((table) => {
      lines.push(table.sql.endsWith(';') ? table.sql : `${table.sql};`)
    })

    // Reverse of added indexes → DROP them
    changes.addedIndexes.forEach((index) => {
      lines.push(`DROP INDEX IF EXISTS "${index.name}";`)
    })

    // Reverse of removed indexes → CREATE them
    changes.removedIndexes.forEach((index) => {
      lines.push(index.sql.endsWith(';') ? index.sql : `${index.sql};`)
    })

    // Reverse of added triggers → DROP them
    changes.addedTriggers.forEach((trigger) => {
      lines.push(`DROP TRIGGER IF EXISTS "${trigger.name}";`)
    })

    // Reverse of removed triggers → CREATE them
    changes.removedTriggers.forEach((trigger) => {
      lines.push(trigger.sql.endsWith(';') ? trigger.sql : `${trigger.sql};`)
    })

    changes.tableChanges.forEach((change) => {
      // Reverse of added columns → remove them (not directly supported in SQLite)
      change.addedColumns.forEach((column) => {
        lines.push(`-- Column to remove: ${change.table}.${column.name}`)
      })

      // Reverse of removed columns → add them back
      change.removedColumns.forEach((column) => {
        lines.push(`ALTER TABLE "${change.table}" ADD COLUMN "${column.name}" ${column.type};`)
      })

      // Reverse of modified columns
      change.modifiedColumns.forEach((column) => {
        lines.push(`-- Column modified: ${change.table}.${column.name} ${column.toType} -> ${column.fromType}`)
      })
    })

    return lines.join('\n')
  }

  async function loadCompareChanges() {
    if (compareBranches.a === compareBranches.b) {
      setCompareErrorMessage('Select two different branches to compare')
      return
    }

    setCompareLoading(true)
    setCompareErrorMessage(null)

    try {
      const baseSql = `
        SELECT type, name, sql
        FROM sqlite_master
        WHERE sql NOT NULL
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '_studio_%'
        ORDER BY type, name
      `

      const [schemaA, schemaB] = await Promise.all([
        executeCompareQuery(compareBranches.a, baseSql),
        executeCompareQuery(compareBranches.b, baseSql)
      ])

      const rowsA = (schemaA.rows || []) as CompareSchemaItem[]
      const rowsB = (schemaB.rows || []) as CompareSchemaItem[]

      const byType = (rows: CompareSchemaItem[], type: string) => rows.filter(row => row.type === type)

      const tablesA = byType(rowsA, 'table')
      const tablesB = byType(rowsB, 'table')
      const indexesA = byType(rowsA, 'index')
      const indexesB = byType(rowsB, 'index')
      const triggersA = byType(rowsA, 'trigger')
      const triggersB = byType(rowsB, 'trigger')

      const tableNamesA = new Set(tablesA.map(item => item.name))
      const tableNamesB = new Set(tablesB.map(item => item.name))
      const commonTables = tablesA
        .map(item => item.name)
        .filter(name => tableNamesB.has(name))

      const fetchTableInfoMap = async (branch: string, tables: string[]) => {
        const entries = await Promise.all(tables.map(async (name) => {
          const info = await executeCompareQuery(branch, `PRAGMA table_info(\"${name}\")`)
          return [name, info.rows as CompareColumnInfo[]] as const
        }))
        return new Map(entries)
      }

      const fetchRowCounts = async (branch: string, tables: string[]) => {
        const entries = await Promise.all(tables.map(async (name) => {
          const info = await executeCompareQuery(branch, `SELECT COUNT(*) as count FROM \"${name}\"`)
          const count = info.rows?.[0]?.count ?? 0
          return [name, Number(count)] as const
        }))
        return new Map(entries)
      }

      const [tableInfoA, tableInfoB, rowCountsA, rowCountsB] = await Promise.all([
        fetchTableInfoMap(compareBranches.a, commonTables),
        fetchTableInfoMap(compareBranches.b, commonTables),
        fetchRowCounts(compareBranches.a, commonTables),
        fetchRowCounts(compareBranches.b, commonTables)
      ])

      const tableChanges: CompareTableChange[] = []

      commonTables.forEach((table) => {
        const colsA = tableInfoA.get(table) || []
        const colsB = tableInfoB.get(table) || []

        const mapA = new Map(colsA.map(col => [col.name, col]))
        const mapB = new Map(colsB.map(col => [col.name, col]))

        const addedColumns = colsB.filter(col => !mapA.has(col.name))
        const removedColumns = colsA.filter(col => !mapB.has(col.name))
        const modifiedColumns: Array<{ name: string; fromType: string; toType: string }> = []

        colsA.forEach((col) => {
          const match = mapB.get(col.name)
          if (!match) return
          const fromType = normalizeColumnType(col.type)
          const toType = normalizeColumnType(match.type)
          if (fromType !== toType) {
            modifiedColumns.push({ name: col.name, fromType, toType })
          }
        })

        const countA = rowCountsA.get(table) ?? 0
        const countB = rowCountsB.get(table) ?? 0
        const hasRowDiff = countA !== countB

        if (addedColumns.length || removedColumns.length || modifiedColumns.length || hasRowDiff) {
          tableChanges.push({
            table,
            addedColumns,
            removedColumns,
            modifiedColumns,
            rowCounts: { a: countA, b: countB }
          })
        }
      })

      const onlyInA = (rows: CompareSchemaItem[], namesB: Set<string>) => rows.filter(row => !namesB.has(row.name))
      const onlyInB = (rows: CompareSchemaItem[], namesA: Set<string>) => rows.filter(row => !namesA.has(row.name))

      const indexNamesA = new Set(indexesA.map(item => item.name))
      const indexNamesB = new Set(indexesB.map(item => item.name))
      const triggerNamesA = new Set(triggersA.map(item => item.name))
      const triggerNamesB = new Set(triggersB.map(item => item.name))

      const changes: CompareChanges = {
        addedTables: onlyInB(tablesB, tableNamesA),
        removedTables: onlyInA(tablesA, tableNamesB),
        addedIndexes: onlyInB(indexesB, indexNamesA),
        removedIndexes: onlyInA(indexesA, indexNamesB),
        addedTriggers: onlyInB(triggersB, triggerNamesA),
        removedTriggers: onlyInA(triggersA, triggerNamesB),
        tableChanges
      }

      setCompareChanges(changes)
    } catch (error: any) {
      console.error('Failed to load compare changes:', error)
      setCompareErrorMessage(error.message || 'Failed to load compare changes')
      setCompareChanges(null)
    } finally {
      setCompareLoading(false)
    }
  }

  // Compare Mode shows truth, not power.
  // All actions are read-only and branch-explicit.
  function hasForbiddenCompareSql(sql: string): boolean {
    // Blocked operations in Compare Mode (STRICT)
    // INSERT, UPDATE, DELETE, ALTER, DROP, CREATE, VACUUM
    // Any transaction (BEGIN, COMMIT, ROLLBACK)
    const forbidden = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|ATTACH|DETACH|VACUUM|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|REINDEX)\b/i
    return forbidden.test(sql)
  }

  function getCompareErrorMessage(): string {
    return 'Compare Mode is read-only. Switch off Compare to modify data.'
  }

  function getCompareSqlForTerminal(target: 'a' | 'b') {
    return target === 'a' ? compareSqlA : compareSqlB
  }

  function setCompareSqlForTerminal(target: 'a' | 'b', value: string) {
    if (target === 'a') {
      setCompareSqlA(value)
    } else {
      setCompareSqlB(value)
    }
  }

  function handleCompareBranchChange(target: 'a' | 'b', value: string) {
    setCompareBranches(prev => {
      const next = { ...prev, [target]: value }
      if (!next.a || !next.b || next.a === next.b) {
        setCompareErrorMessage('Select two different branches to compare')
      } else {
        setCompareErrorMessage(null)
      }
      setCompareChanges(null)
      setCompareResults({ a: null, b: null })
      setCompareErrors({ a: null, b: null })
      return next
    })
  }

  function handleToggleCompareMode() {
    if (compareEnabled) {
      if (compareBranches.a && compareBranches.b) {
        closeCompareBranches([compareBranches.a, compareBranches.b]).catch(() => null)
      }
      setCompareEnabled(false)
    } else {
      setCompareEnabled(true)
    }
  }

  async function handleCompareExecuteSingle(target: 'a' | 'b') {
    const sql = getCompareSqlForTerminal(target)
    const branch = target === 'a' ? compareBranches.a : compareBranches.b

    if (!sql.trim()) return { skipped: true }
    if (!branch) return { skipped: true }

    if (hasForbiddenCompareSql(sql)) {
      return { error: { message: getCompareErrorMessage() }, target }
    }

    const startTime = performance.now()

    try {
      const data = await executeCompareQuery(branch, sql)
      const executionTime = Math.round(performance.now() - startTime)
      const queryType = detectQueryType(sql)

      return { success: true, target, data, executionTime, queryType }
    } catch (err: any) {
      return { error: { message: err.message }, target }
    }
  }

  async function handleCompareExecuteBoth() {
    if (!compareBranchesValid) return

    setLoading(true)
    setCompareErrors({ a: null, b: null })
    setCompareResults({ a: null, b: null })
    updateActiveTab('result')

    const [resultA, resultB] = await Promise.all([
      handleCompareExecuteSingle('a'),
      handleCompareExecuteSingle('b')
    ])

    let hasErrors = false

    // Process result A
    if (resultA && !('skipped' in resultA)) {
      if ('error' in resultA && resultA.error) {
        setCompareErrors(prev => ({ ...prev, a: resultA.error as ErrorDetails }))
        hasErrors = true
      } else if ('success' in resultA && resultA.success) {
        setCompareQueryTypes(prev => ({ ...prev, a: resultA.queryType || 'SELECT' }))
        setCompareResults(prev => ({
          ...prev,
          a: { ...resultA.data, executionTime: resultA.executionTime }
        }))
      }
    }

    // Process result B
    if (resultB && !('skipped' in resultB)) {
      if ('error' in resultB && resultB.error) {
        setCompareErrors(prev => ({ ...prev, b: resultB.error as ErrorDetails }))
        hasErrors = true
      } else if ('success' in resultB && resultB.success) {
        setCompareQueryTypes(prev => ({ ...prev, b: resultB.queryType || 'SELECT' }))
        setCompareResults(prev => ({
          ...prev,
          b: { ...resultB.data, executionTime: resultB.executionTime }
        }))
      }
    }

    if (hasErrors) {
      updateActiveTab('errors')
    }

    setLoading(false)
  }

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor
    monacoRef.current = monaco

    // Initialize providers
    completionProviderRef.current = new SQLCompletionProvider()
    hoverProviderRef.current = new SQLHoverProvider()

    // Register completion provider
    monaco.languages.registerCompletionItemProvider('sql', completionProviderRef.current)
    
    // Register signature help provider
    monaco.languages.registerSignatureHelpProvider('sql', new SQLSignatureHelpProvider())
    
    // Register hover provider
    monaco.languages.registerHoverProvider('sql', hoverProviderRef.current)

    // Custom key bindings
    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
      ],
      run: () => {
        handleExecute()
      }
    })

    editor.addAction({
      id: 'run-selected',
      label: 'Run Selected Query',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter
      ],
      run: () => {
        const selection = editor.getSelection()
        const selectedText = editor.getModel().getValueInRange(selection)
        if (selectedText.trim()) {
          handleExecute(selectedText)
        } else {
          handleExecute()
        }
      }
    })

    // Format SQL action
    editor.addAction({
      id: 'format-sql',
      label: 'Format SQL',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF
      ],
      run: () => {
        editor.getAction('editor.action.formatDocument').run()
      }
    })

    // Reload schema
    loadSchemaForAutocomplete()
  }

  async function handleExecute(customSql?: string) {
    const queryToRun = customSql || editorState.sql
    if (!queryToRun.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)
    updateActiveTab('result')

    const startTime = performance.now()

    try {
      const data = await executeQuery(queryToRun)
      const executionTime = Math.round(performance.now() - startTime)

      // Detect query type
      const queryType = detectQueryType(queryToRun)
      setLastQueryType(queryType)
      setLastExecutedSQL(queryToRun)

      setResult({
        ...data,
        executionTime
      })

      // Reload schema if it was a DDL statement
      if (/CREATE|ALTER|DROP/i.test(queryToRun)) {
        loadSchemaForAutocomplete()
      }
    } catch (err: any) {
      const errorDetails: ErrorDetails = {
        message: err.message,
        code: err.code,
        errno: err.errno
      }

      setError(errorDetails)

      // Add to error history (keep last 5)
      setErrorHistory(prev => [
        { sql: queryToRun, error: errorDetails, timestamp: Date.now() },
        ...prev.slice(0, 4)
      ])

      updateActiveTab('errors')
    } finally {
      setLoading(false)
    }
  }

  function detectQueryType(sql: string): string {
    const upper = sql.trim().toUpperCase()
    if (upper.startsWith('SELECT')) return 'SELECT'
    if (upper.startsWith('INSERT')) return 'INSERT'
    if (upper.startsWith('UPDATE')) return 'UPDATE'
    if (upper.startsWith('DELETE')) return 'DELETE'
    if (upper.startsWith('CREATE')) return 'CREATE'
    if (upper.startsWith('ALTER')) return 'ALTER'
    if (upper.startsWith('DROP')) return 'DROP'
    return 'UNKNOWN'
  }

  function getSuggestedTable(error: string): string | null {
    // Simple table suggestion based on common typos
    // In a real app, you'd use fuzzy matching with actual table names
    if (error.includes('no such table')) {
      return 'Run PRAGMA table_list; to see available tables.'
    }
    if (error.includes('no such column')) {
      return 'Check your column names. Use PRAGMA table_info(table_name); to see columns.'
    }
    return null
  }

  function isMigrationEligible(queryType: string): boolean {
    return ['CREATE', 'ALTER', 'DROP'].includes(queryType)
  }

  async function handleSaveMigration() {
    if (!editorState.sql.trim()) {
      alert('No SQL to save as migration')
      return
    }
    setShowMigrationModal(true)
  }

  async function handleCreateMigration() {
    if (!migrationName.trim()) {
      alert('Please enter a migration name')
      return
    }

    setSavingMigration(true)
    try {
      await createMigration(migrationName.trim(), editorState.sql)
      setShowMigrationModal(false)
      setMigrationName('')
      alert('Migration created successfully!')
    } catch (err: any) {
      alert(`Failed to create migration: ${err.message}`)
    } finally {
      setSavingMigration(false)
    }
  }

  function handleSaveSelectionAsFavorite() {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection()
      const selectedText = editorRef.current.getModel().getValueInRange(selection)

      if (!selectedText.trim()) {
        alert('Please select SQL text first')
        return
      }

      setSelectedSQL(selectedText)
      setShowFavoriteModal(true)
    }
  }

  function handleCreateFavorite() {
    if (!favoriteName.trim()) {
      alert('Please enter a name for the favorite')
      return
    }

    addFavorite(favoriteName.trim(), selectedSQL)
    setShowFavoriteModal(false)
    setFavoriteName('')
    setSelectedSQL('')
  }

  async function handleTakeSnapshot() {
    setShowSnapshotModal(true)
  }

  async function handleCreateSnapshot() {
    setCreatingSnapshot(true)
    try {
      await createSnapshot(snapshotName.trim() || undefined)
      setShowSnapshotModal(false)
      setSnapshotName('')
      alert('Snapshot created successfully!')
    } catch (err: any) {
      alert(`Failed to create snapshot: ${err.message}`)
    } finally {
      setCreatingSnapshot(false)
    }
  }

  function handleExport(format: 'csv' | 'json' | 'sql' | 'markdown') {
    if (!result?.rows || result.rows.length === 0) {
      alert('No data to export')
      return
    }

    let content = ''
    let filename = ''
    let mimeType = ''

    switch (format) {
      case 'csv':
        content = exportAsCSV(result.rows)
        filename = `query_result_${Date.now()}.csv`
        mimeType = 'text/csv'
        break
      case 'json':
        content = JSON.stringify(result.rows, null, 2)
        filename = `query_result_${Date.now()}.json`
        mimeType = 'application/json'
        break
      case 'sql':
        content = exportAsSQL()
        filename = `query_${Date.now()}.sql`
        mimeType = 'text/plain'
        break
      case 'markdown':
        content = exportAsMarkdown(result.rows)
        filename = `query_result_${Date.now()}.md`
        mimeType = 'text/markdown'
        break
    }

    downloadFile(content, filename, mimeType)
    setShowExportMenu(false)
  }

  function exportAsCSV(rows: any[]): string {
    if (rows.length === 0) return ''

    const columns = Object.keys(rows[0])
    const header = columns.join(',')
    const data = rows.map(row =>
      columns.map(col => {
        const value = row[col]
        if (value === null) return 'NULL'
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    ).join('\n')

    return `${header}\n${data}`
  }

  function exportAsMarkdown(rows: any[]): string {
    if (rows.length === 0) return ''

    const columns = Object.keys(rows[0])
    const header = `| ${columns.join(' | ')} |`
    const separator = `| ${columns.map(() => '---').join(' | ')} |`
    const data = rows.map(row =>
      `| ${columns.map(col => row[col] === null ? 'NULL' : row[col]).join(' | ')} |`
    ).join('\n')

    return `${header}\n${separator}\n${data}`
  }

  function exportAsSQL(): string {
    const timestamp = new Date().toISOString()
    return `-- Exported from LocalDB\n-- Date: ${timestamp}\n-- Query Type: ${lastQueryType}\n\n${lastExecutedSQL}`
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const compareDisabledTitle = 'Disabled in Compare Mode'
  const compareBranchesValid = !!compareBranches.a && !!compareBranches.b && compareBranches.a !== compareBranches.b
  const canRunCompare = compareEnabled && compareTab === 'manual' && compareBranchesValid

  function renderRowsTable(rows: any[]) {
    if (rows.length === 0) {
      return (
        <div className="text-app-text-dim text-center py-6 text-sm">
          No rows returned
        </div>
      )
    }

    return (
      <div className="border border-app-panel-border rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-app-sidebar-active">
            <tr>
              {Object.keys(rows[0]).map((key) => (
                <th key={key} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, i: number) => (
              <tr key={i} className="border-t border-app-panel-border hover:bg-app-sidebar-hover">
                {Object.values(row).map((value: any, j: number) => (
                  <td key={j} className="px-3 py-2 font-mono">
                    {value === null ? (
                      <span className="text-app-text-dim italic">NULL</span>
                    ) : (
                      String(value)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderCompareResult(label: string, result: ExecutionResult | null, error: ErrorDetails | null) {
    return (
      <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
        <div className="text-xs text-app-text-dim mb-2">Results — {label}</div>
        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
            <div className="text-red-400 font-semibold text-sm mb-1">Error</div>
            <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
              {error.message}
            </pre>
          </div>
        ) : result ? (
          <>
            <div className="mb-2 text-xs text-app-text-dim">
              {result.rows?.length || 0} rows returned in {result.executionTime}ms
            </div>
            {renderRowsTable(result.rows || [])}
          </>
        ) : (
          <div className="text-xs text-app-text-dim">No results yet</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Inner Sidebar */}
      <InnerSidebar 
        width="220px" 
        disabled={compareEnabled} 
        privateItems={privateItems}
        onPrivateItemsChange={setPrivateItems}
        onOpenFile={(item, section) => {
          if (item.sql) {
            // Check if file is already open in a tab
            const existingTab = queryTabs.find(t => t.name === item.label && t.sql === item.sql)
            if (existingTab) {
              // Switch to existing tab
              setActiveQueryTabId(existingTab.id)
            } else {
              // Open file in a new tab
              const newId = `tab-${Date.now()}`
              const newTab: QueryTab = { id: newId, name: item.label, sql: item.sql }
              setQueryTabs(prev => [...prev, newTab])
              setActiveQueryTabId(newId)
            }
          }
        }}
      />

      {/* Main Editor Area */}
      <div ref={containerRef} className="flex-1 grid min-h-0" style={{ gridTemplateRows: `minmax(220px, 1fr) 8px ${resultHeight}px` }}>
        {/* Editor */}
        <div className="flex flex-col border-b border-app-border min-h-0">
          {/* SQL Editor Bar */}
          <div className="px-4 py-2 bg-app-sidebar/30 border-b border-app-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase text-app-text-dim">SQL Editor</span>
              <button
                onClick={handleToggleCompareMode}
                className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-2 ${compareEnabled ? 'bg-app-accent/20 text-app-accent' : 'bg-app-sidebar-active hover:bg-app-sidebar-hover text-app-text'}`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Compare {compareEnabled ? 'On' : 'Off'}
              </button>
            </div>

            {compareEnabled && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-app-text-dim">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Branch A</span>
                  <select
                    value={compareBranches.a}
                    onChange={(event) => handleCompareBranchChange('a', event.target.value)}
                    className="bg-app-bg border border-app-border rounded px-2 py-1 text-xs text-app-text"
                  >
                    {compareBranchOptions.map((branch) => (
                      <option key={branch} value={branch} disabled={branch === compareBranches.b}>{branch}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-app-sidebar-active rounded p-1">
                  <button
                    onClick={() => setCompareTab('change')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${compareTab === 'change' ? 'bg-app-accent/20 text-app-accent' : 'text-app-text-dim hover:text-app-text'}`}
                    disabled={!!compareErrorMessage}
                  >
                    <List className="w-3.5 h-3.5" />
                    Change View
                  </button>
                  <button
                    onClick={() => setCompareTab('preview')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${compareTab === 'preview' ? 'bg-app-accent/20 text-app-accent' : 'text-app-text-dim hover:text-app-text'}`}
                    disabled={!!compareErrorMessage}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    SQL Preview
                  </button>
                  <button
                    onClick={() => setCompareTab('manual')}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${compareTab === 'manual' ? 'bg-app-accent/20 text-app-accent' : 'text-app-text-dim hover:text-app-text'}`}
                    disabled={!!compareErrorMessage}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Manual Inspect
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-app-text-dim">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Branch B</span>
                  <select
                    value={compareBranches.b}
                    onChange={(event) => handleCompareBranchChange('b', event.target.value)}
                    className="bg-app-bg border border-app-border rounded px-2 py-1 text-xs text-app-text"
                  >
                    {compareBranchOptions.map((branch) => (
                      <option key={branch} value={branch} disabled={branch === compareBranches.a}>{branch}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {!compareEnabled ? (
            <>
              {/* Query Tabs Bar */}
              <div className="bg-app-sidebar/50 border-b border-app-border flex items-center overflow-x-auto">
                {queryTabs.map((tab) => (
                  <div
                    key={tab.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, tab.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, tab.id)}
                    onClick={() => setActiveQueryTabId(tab.id)}
                    onDoubleClick={() => startRenaming(tab.id, tab.name)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setTabContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
                    }}
                    onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                    tabIndex={0}
                    className={`
                      group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-r border-app-border
                      transition-colors outline-none focus:ring-1 focus:ring-app-accent/50
                      ${tab.id === activeQueryTabId 
                        ? 'bg-app-bg text-app-text' 
                        : 'text-app-text-dim hover:bg-app-sidebar-hover hover:text-app-text'
                      }
                      ${draggedTabId === tab.id ? 'opacity-50' : ''}
                    `}
                  >
                    <FileCode className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                    {renamingTabId === tab.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        onBlur={finishRenaming}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') finishRenaming()
                          if (e.key === 'Escape') {
                            setRenamingTabId(null)
                            setRenamingValue('')
                          }
                          e.stopPropagation()
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-app-bg border border-app-accent rounded px-1 py-0.5 text-xs w-32 outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate max-w-[150px]">{tab.name}</span>
                    )}
                    {queryTabs.length > 1 && (
                      <button
                        onClick={(e) => closeTab(tab.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:bg-app-border rounded p-0.5 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addNewTab}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-app-text-dim hover:text-app-text hover:bg-app-sidebar-hover transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
              </div>
              <div className="flex-1 bg-[#0f0f0f] min-h-0">
                <MonacoEditor
                  height="100%"
                  language="sql"
                  theme="vs-dark"
                  value={activeQueryTab?.sql || ''}
                  onChange={(value) => updateCurrentTabSQL(value || '')}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 16, bottom: 16 },
                    fontFamily: 'Monaco, Menlo, "Courier New", monospace',
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: {
                      other: true,
                      comments: false,
                      strings: false
                    },
                    parameterHints: {
                      enabled: true
                    },
                    suggest: {
                      showKeywords: true,
                      showSnippets: true,
                      showFunctions: true,
                      snippetsPreventQuickSuggestions: false
                    },
                    formatOnPaste: true,
                    formatOnType: true,
                    autoClosingBrackets: 'always',
                    autoClosingQuotes: 'always',
                    bracketPairColorization: {
                      enabled: true
                    }
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 bg-[#0f0f0f] min-h-0 overflow-hidden">
              {compareErrorMessage && (
                <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/30">
                  {compareErrorMessage}
                </div>
              )}

              {compareTab === 'change' && (
                <div className="h-full overflow-auto">
                  {compareLoading ? (
                    <div className="text-xs text-app-text-dim p-4">Loading changes...</div>
                  ) : compareChanges ? (
                    (() => {
                      const hasChanges =
                        compareChanges.addedTables.length ||
                        compareChanges.removedTables.length ||
                        compareChanges.addedIndexes.length ||
                        compareChanges.removedIndexes.length ||
                        compareChanges.addedTriggers.length ||
                        compareChanges.removedTriggers.length ||
                        compareChanges.tableChanges.length

                      if (!hasChanges) {
                        return (
                          <div className="text-sm text-app-text-dim p-4">No differences between selected branches</div>
                        )
                      }

                      // Helper to render a clickable item that navigates to Manual Inspect
                      const handleTableClick = (tableName: string) => {
                        setCompareSqlA(`SELECT * FROM sqlite_master WHERE type='table' AND name='${tableName}';`)
                        setCompareSqlB(`SELECT * FROM sqlite_master WHERE type='table' AND name='${tableName}';`)
                        setCompareTab('manual')
                      }

                      const handleColumnClick = (tableName: string) => {
                        setCompareSqlA(`PRAGMA table_info("${tableName}");`)
                        setCompareSqlB(`PRAGMA table_info("${tableName}");`)
                        setCompareTab('manual')
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 h-full gap-px bg-app-border">
                          {/* Branch A Panel */}
                          <div className="bg-app-bg flex flex-col min-h-0">
                            <div className="px-3 py-2 border-b border-app-border bg-app-sidebar/30 flex items-center gap-2">
                              <GitBranch className="w-3.5 h-3.5 text-app-text-dim" />
                              <span className="text-xs font-semibold text-app-text">{compareBranches.a || 'Branch A'}</span>
                            </div>
                            <div className="flex-1 overflow-auto p-4 space-y-4">
                              {/* Tables (+) in A */}
                              {compareChanges.removedTables.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-400 mb-2">Tables (+)</h4>
                                  <div className="space-y-1">
                                    {compareChanges.removedTables.map((table) => (
                                      <button
                                        key={table.name}
                                        onClick={() => handleTableClick(table.name)}
                                        className="w-full text-left px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded hover:bg-app-sidebar-hover"
                                      >
                                        <span className="text-green-400">+</span> {table.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Tables (−) in A */}
                              {compareChanges.addedTables.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-red-400 mb-2">Tables (−)</h4>
                                  <div className="space-y-1">
                                    {compareChanges.addedTables.map((table) => (
                                      <button
                                        key={table.name}
                                        onClick={() => handleTableClick(table.name)}
                                        className="w-full text-left px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded hover:bg-app-sidebar-hover opacity-60"
                                      >
                                        <span className="text-red-400">−</span> {table.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Table changes */}
                              {compareChanges.tableChanges.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-app-text-dim mb-2">Table changes</h4>
                                  <div className="space-y-2">
                                    {compareChanges.tableChanges.map((change) => (
                                      <button
                                        key={change.table}
                                        onClick={() => handleColumnClick(change.table)}
                                        className="w-full text-left px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded hover:bg-app-sidebar-hover"
                                      >
                                        <div className="font-medium text-app-text mb-1">{change.table}</div>
                                        <div className="space-y-1 text-xs text-app-text-dim">
                                          {change.removedColumns.map((col) => (
                                            <div key={`removed-${col.name}`}><span className="text-green-400">+</span> {col.name} ({col.type})</div>
                                          ))}
                                          {change.addedColumns.map((col) => (
                                            <div key={`added-${col.name}`}><span className="text-red-400">−</span> {col.name}</div>
                                          ))}
                                          {change.modifiedColumns.map((col) => (
                                            <div key={`modified-${col.name}`}><span className="text-yellow-400">≈</span> {col.name} ({col.fromType})</div>
                                          ))}
                                          {change.rowCounts && (
                                            <div className="text-yellow-400">≈ rows: {change.rowCounts.a}</div>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Indexes (+) */}
                              {compareChanges.removedIndexes.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-400 mb-2">Indexes (+)</h4>
                                  <div className="space-y-1">
                                    {compareChanges.removedIndexes.map((index) => (
                                      <div key={index.name} className="px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded">
                                        <span className="text-green-400">+</span> {index.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Triggers (+) */}
                              {compareChanges.removedTriggers.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-400 mb-2">Triggers (+)</h4>
                                  <div className="space-y-1">
                                    {compareChanges.removedTriggers.map((trigger) => (
                                      <div key={trigger.name} className="px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded">
                                        <span className="text-green-400">+</span> {trigger.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Branch B Panel */}
                          <div className="bg-app-bg flex flex-col min-h-0">
                            <div className="px-3 py-2 border-b border-app-border bg-app-sidebar/30 flex items-center gap-2">
                              <GitBranch className="w-3.5 h-3.5 text-app-text-dim" />
                              <span className="text-xs font-semibold text-app-text">{compareBranches.b || 'Branch B'}</span>
                            </div>
                            <div className="flex-1 overflow-auto p-4 space-y-4">
                              {/* Tables (+) in B */}
                              {compareChanges.addedTables.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-400 mb-2">Tables (+)</h4>
                                  <div className="space-y-1">
                                    {compareChanges.addedTables.map((table) => (
                                      <button
                                        key={table.name}
                                        onClick={() => handleTableClick(table.name)}
                                        className="w-full text-left px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded hover:bg-app-sidebar-hover"
                                      >
                                        <span className="text-green-400">+</span> {table.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Tables (−) in B */}
                              {compareChanges.removedTables.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-red-400 mb-2">Tables (−)</h4>
                                  <div className="space-y-1">
                                    {compareChanges.removedTables.map((table) => (
                                      <button
                                        key={table.name}
                                        onClick={() => handleTableClick(table.name)}
                                        className="w-full text-left px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded hover:bg-app-sidebar-hover opacity-60"
                                      >
                                        <span className="text-red-400">−</span> {table.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Table changes */}
                              {compareChanges.tableChanges.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-app-text-dim mb-2">Table changes</h4>
                                  <div className="space-y-2">
                                    {compareChanges.tableChanges.map((change) => (
                                      <button
                                        key={change.table}
                                        onClick={() => handleColumnClick(change.table)}
                                        className="w-full text-left px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded hover:bg-app-sidebar-hover"
                                      >
                                        <div className="font-medium text-app-text mb-1">{change.table}</div>
                                        <div className="space-y-1 text-xs text-app-text-dim">
                                          {change.addedColumns.map((col) => (
                                            <div key={`added-${col.name}`}><span className="text-green-400">+</span> {col.name} ({col.type})</div>
                                          ))}
                                          {change.removedColumns.map((col) => (
                                            <div key={`removed-${col.name}`}><span className="text-red-400">−</span> {col.name}</div>
                                          ))}
                                          {change.modifiedColumns.map((col) => (
                                            <div key={`modified-${col.name}`}><span className="text-yellow-400">≈</span> {col.name} ({col.toType})</div>
                                          ))}
                                          {change.rowCounts && (
                                            <div className="text-yellow-400">≈ rows: {change.rowCounts.b}</div>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Indexes (+) */}
                              {compareChanges.addedIndexes.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-400 mb-2">Indexes (+)</h4>
                                  <div className="space-y-1">
                                    {compareChanges.addedIndexes.map((index) => (
                                      <div key={index.name} className="px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded">
                                        <span className="text-green-400">+</span> {index.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Triggers (+) */}
                              {compareChanges.addedTriggers.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-400 mb-2">Triggers (+)</h4>
                                  <div className="space-y-1">
                                    {compareChanges.addedTriggers.map((trigger) => (
                                      <div key={trigger.name} className="px-3 py-2 text-sm bg-app-sidebar border border-app-border rounded">
                                        <span className="text-green-400">+</span> {trigger.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="text-xs text-app-text-dim p-4">Select two branches to compare.</div>
                  )}
                </div>
              )}

              {compareTab === 'preview' && (
                <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-px bg-app-border">
                  {/* A → B Panel */}
                  <div className="bg-app-bg flex flex-col min-h-0">
                    <div className="px-3 py-2 border-b border-app-border bg-app-sidebar/30 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <GitBranch className="w-3.5 h-3.5 text-app-text-dim" />
                        <span className="font-semibold text-app-text">{compareBranches.a}</span>
                        <span className="text-app-text-dim">→</span>
                        <span className="font-semibold text-app-text">{compareBranches.b}</span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(compareSqlPreview)
                        }}
                        className="px-2 py-1 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded flex items-center gap-1.5"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                    <div className="px-3 py-1.5 bg-app-sidebar/20 border-b border-app-border/50 text-xs text-app-text-dim">
                      Apply these changes to transform {compareBranches.a} into {compareBranches.b} (read-only)
                    </div>
                    <div className="flex-1 min-h-0">
                      <MonacoEditor
                        height="100%"
                        language="sql"
                        theme="vs-dark"
                        value={compareSqlPreview || '-- No changes detected'}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          readOnly: true,
                          tabSize: 2,
                          padding: { top: 16, bottom: 16 },
                          fontFamily: 'Monaco, Menlo, "Courier New", monospace'
                        }}
                      />
                    </div>
                  </div>

                  {/* B → A Panel */}
                  <div className="bg-app-bg flex flex-col min-h-0">
                    <div className="px-3 py-2 border-b border-app-border bg-app-sidebar/30 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <GitBranch className="w-3.5 h-3.5 text-app-text-dim" />
                        <span className="font-semibold text-app-text">{compareBranches.b}</span>
                        <span className="text-app-text-dim">→</span>
                        <span className="font-semibold text-app-text">{compareBranches.a}</span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(compareSqlPreviewReverse)
                        }}
                        className="px-2 py-1 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded flex items-center gap-1.5"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                    <div className="px-3 py-1.5 bg-app-sidebar/20 border-b border-app-border/50 text-xs text-app-text-dim">
                      Apply these changes to transform {compareBranches.b} into {compareBranches.a} (read-only)
                    </div>
                    <div className="flex-1 min-h-0">
                      <MonacoEditor
                        height="100%"
                        language="sql"
                        theme="vs-dark"
                        value={compareSqlPreviewReverse || '-- No changes detected'}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          readOnly: true,
                          tabSize: 2,
                          padding: { top: 16, bottom: 16 },
                          fontFamily: 'Monaco, Menlo, "Courier New", monospace'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {compareTab === 'manual' && (
                <div className="grid grid-cols-1 md:grid-cols-2 h-full gap-px bg-app-border">
                  <div
                    className={`flex flex-col min-h-0 ${compareActiveTerminal === 'a' ? 'bg-app-bg' : 'bg-app-bg'}`}
                    onClick={() => setCompareActiveTerminal('a')}
                  >
                    <div className="px-3 py-2 border-b border-app-border bg-app-sidebar/30 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <GitBranch className="w-3.5 h-3.5 text-app-text-dim" />
                        <span className="font-semibold text-app-text">{compareBranches.a || 'Branch A'}</span>
                      </div>
                      <span className="text-xs text-app-text-dim">Editor A</span>
                    </div>
                    <div className="flex-1 min-h-0">
                      <MonacoEditor
                        height="100%"
                        language="sql"
                        theme="vs-dark"
                        value={compareSqlA}
                        onChange={(value) => setCompareSqlForTerminal('a', value || '')}
                        onMount={(editor) => {
                          editor.onDidFocusEditorWidget(() => setCompareActiveTerminal('a'))
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          padding: { top: 16, bottom: 16 },
                          fontFamily: 'Monaco, Menlo, "Courier New", monospace'
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className={`flex flex-col min-h-0 ${compareActiveTerminal === 'b' ? 'bg-app-bg' : 'bg-app-bg'}`}
                    onClick={() => setCompareActiveTerminal('b')}
                  >
                    <div className="px-3 py-2 border-b border-app-border bg-app-sidebar/30 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <GitBranch className="w-3.5 h-3.5 text-app-text-dim" />
                        <span className="font-semibold text-app-text">{compareBranches.b || 'Branch B'}</span>
                      </div>
                      <span className="text-xs text-app-text-dim">Editor B</span>
                    </div>
                    <div className="flex-1 min-h-0">
                      <MonacoEditor
                        height="100%"
                        language="sql"
                        theme="vs-dark"
                        value={compareSqlB}
                        onChange={(value) => setCompareSqlForTerminal('b', value || '')}
                        onMount={(editor) => {
                          editor.onDidFocusEditorWidget(() => setCompareActiveTerminal('b'))
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          padding: { top: 16, bottom: 16 },
                          fontFamily: 'Monaco, Menlo, "Courier New", monospace'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={() => {
            isResizingRef.current = true
            document.body.style.cursor = 'row-resize'
          }}
          onTouchStart={() => {
            isResizingRef.current = true
            document.body.style.cursor = 'row-resize'
          }}
          className="bg-app-sidebar/40 border-y border-app-border cursor-row-resize flex items-center justify-center"
        >
          <div className="w-10 h-1 rounded-full bg-app-border" />
        </div>

        {/* Results Panel */}
        <div className="flex flex-col bg-app-panel border-t border-app-panel-border overflow-hidden min-h-0">
          {/* Tabs + Actions */}
          <div className="px-4 py-2.5 border-b border-app-panel-border bg-app-sidebar/30 flex-shrink-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
              {(['result', 'errors', 'info'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => updateActiveTab(tab)}
                  className={`
                    px-2 py-1 text-sm capitalize transition-colors font-medium
                    ${editorState.activeTab === tab
                      ? 'text-app-text border-b-2 border-app-accent'
                      : 'text-app-text-dim hover:text-app-text'
                    }
                  `}
                >
                  {tab}
                </button>
              ))}
              </div>

              {/* Keyboard hints (subtle) */}
              {!compareEnabled && (
                <div className="hidden lg:flex items-center gap-3 text-[10px] text-app-text-dim/60">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-app-bg/50 border border-app-border/50 rounded text-[10px]">⌘↵</kbd>
                    run
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-app-bg/50 border border-app-border/50 rounded text-[10px]">⌘⇧↵</kbd>
                    selected
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-app-bg/50 border border-app-border/50 rounded text-[10px]">⌘Space</kbd>
                    autocomplete
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">

              {/* Export Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => {
                    if (!compareEnabled) setShowExportMenu(!showExportMenu)
                  }}
                  disabled={compareEnabled || !result?.rows || result.rows.length === 0}
                  title={compareEnabled ? compareDisabledTitle : undefined}
                  className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                  {compareEnabled && <Lock className="w-3 h-3 text-app-text-dim" />}
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showExportMenu && (
                  <div className="absolute top-full mt-1 right-0 bg-app-sidebar border border-app-border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-app-sidebar-hover flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-app-sidebar-hover flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Export as JSON
                    </button>
                    <button
                      onClick={() => handleExport('markdown')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-app-sidebar-hover flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Export as Markdown
                    </button>
                    <button
                      onClick={() => handleExport('sql')}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-app-sidebar-hover flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Export Query (SQL)
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleTakeSnapshot}
                disabled={compareEnabled}
                title={compareEnabled ? compareDisabledTitle : undefined}
                className="px-3 py-1.5 text-xs bg-app-border hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Take snapshot
                {compareEnabled && <Lock className="w-3 h-3 text-app-text-dim" />}
              </button>
              <button
                onClick={handleSaveSelectionAsFavorite}
                disabled={compareEnabled}
                title={compareEnabled ? compareDisabledTitle : undefined}
                className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors flex items-center gap-1.5"
              >
                <Star className="w-3.5 h-3.5" />
                Save as Favorite
                {compareEnabled && <Lock className="w-3 h-3 text-app-text-dim" />}
              </button>
              <button
                onClick={handleSaveMigration}
                disabled={compareEnabled}
                title={compareEnabled ? compareDisabledTitle : undefined}
                className="px-3 py-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-50 text-orange-400 rounded transition-colors flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save as Migration
                {compareEnabled && <Lock className="w-3 h-3 text-app-text-dim" />}
              </button>
              {(!compareEnabled || compareTab === 'manual') && (
                <button
                  onClick={() => {
                    if (compareEnabled) {
                      handleCompareExecuteBoth()
                    } else {
                      handleExecute()
                    }
                  }}
                  disabled={compareEnabled ? !canRunCompare || loading : loading}
                  title={compareEnabled && !canRunCompare ? 'Run is available in Manual Inspect with two different branches selected' : undefined}
                  className="px-4 py-1.5 text-xs bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors font-medium"
                >
                  {loading ? 'Running...' : 'Run'}
                </button>
              )}
            </div>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {editorState.activeTab === 'result' && (
              <div>
                {compareEnabled ? (
                  compareTab !== 'manual' ? (
                    <div className="text-app-text-dim text-center py-8 text-sm">
                      Results are available in Manual Inspect.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderCompareResult(compareBranches.a || 'Branch A', compareResults.a, compareErrors.a)}
                      {renderCompareResult(compareBranches.b || 'Branch B', compareResults.b, compareErrors.b)}
                    </div>
                  )
                ) : error ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                    <div className="text-red-400 font-semibold text-sm mb-1">Error</div>
                    <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                      {error.message}
                    </pre>
                  </div>
                ) : result ? (
                  <div>
                    {result.type === 'select' ? (
                      <>
                        <div className="mb-2 text-xs text-app-text-dim">
                          {result.rows?.length || 0} rows returned in {result.executionTime}ms
                        </div>
                        {renderRowsTable(result.rows || [])}
                      </>
                    ) : (
                      <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                        <div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-1">
                          <CheckCircle className="w-4 h-4" />
                          Success
                        </div>
                        <div className="text-xs text-app-text-dim">
                          {result.changes} row(s) affected in {result.executionTime}ms
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-app-text-dim text-center py-8 text-sm">
                    Click "Run selected" or press <kbd className="px-1.5 py-0.5 bg-app-sidebar-active rounded text-xs">⌘↵</kbd> to execute
                  </div>
                )}
              </div>
            )}

            {editorState.activeTab === 'errors' && (
              <div>
                {compareEnabled ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                      <div className="text-xs text-app-text-dim mb-2">Errors — {compareBranches.a || 'Branch A'}</div>
                      {compareErrors.a ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                          <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                            {compareErrors.a.message}
                          </pre>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-green-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          No errors
                        </div>
                      )}
                    </div>
                    <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                      <div className="text-xs text-app-text-dim mb-2">Errors — {compareBranches.b || 'Branch B'}</div>
                      {compareErrors.b ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                          <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                            {compareErrors.b.message}
                          </pre>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-green-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          No errors
                        </div>
                      )}
                    </div>
                  </div>
                ) : error ? (
                  <div className="space-y-4">
                    {/* Error Summary */}
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-red-400 font-semibold text-sm">Error</h3>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(error.message)
                                alert('Error copied to clipboard')
                              }}
                              className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 rounded flex items-center gap-1.5"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                          </div>
                          <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                            {error.message}
                          </pre>
                          {error.code && (
                            <div className="mt-2 text-xs text-red-400">
                              Error code: {error.code}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Helpful Hint */}
                    {getSuggestedTable(error.message) && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-blue-400 font-semibold text-sm mb-1">Hint</h4>
                            <p className="text-xs text-app-text-dim">
                              {getSuggestedTable(error.message)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error History */}
                    {errorHistory.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Recent Errors</h4>
                        <div className="space-y-2">
                          {errorHistory.map((item, i) => (
                            <div key={i} className="bg-app-sidebar border border-app-border rounded p-3 text-xs">
                              <div className="text-app-text-dim mb-1">
                                {new Date(item.timestamp).toLocaleTimeString()}
                              </div>
                              <div className="text-red-300 font-mono text-xs">
                                {item.error.message}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2 opacity-50" />
                    <div className="text-app-text-dim text-sm">No errors</div>
                  </div>
                )}
              </div>
            )}

            {editorState.activeTab === 'info' && (
              <div className="space-y-4">
                {compareEnabled ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['a', 'b'] as const).map((target) => {
                      const label = target === 'a' ? (compareBranches.a || 'Branch A') : (compareBranches.b || 'Branch B')
                      const info = compareResults[target]
                      return (
                        <div key={target} className="bg-app-sidebar border border-app-border rounded-lg p-4">
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            Execution Metadata — {label}
                          </h3>
                          {info ? (
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="text-app-text-dim mb-1">Execution time</div>
                                <div className="font-mono">{info.executionTime}ms</div>
                              </div>
                              <div>
                                <div className="text-app-text-dim mb-1">Query type</div>
                                <div className="font-mono">{compareQueryTypes[target]}</div>
                              </div>
                              {info.rows && (
                                <div>
                                  <div className="text-app-text-dim mb-1">Rows returned</div>
                                  <div className="font-mono">{info.rows.length}</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-app-text-dim">No execution yet</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    {/* Execution Metadata */}
                    {result && (
                      <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          Execution Metadata
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="text-app-text-dim mb-1">Execution time</div>
                            <div className="font-mono">{result.executionTime}ms</div>
                          </div>
                          <div>
                            <div className="text-app-text-dim mb-1">Query type</div>
                            <div className="font-mono">{lastQueryType}</div>
                          </div>
                          {result.changes !== undefined && (
                            <div>
                              <div className="text-app-text-dim mb-1">Rows affected</div>
                              <div className="font-mono">{result.changes}</div>
                            </div>
                          )}
                          {result.rows && (
                            <div>
                              <div className="text-app-text-dim mb-1">Rows returned</div>
                              <div className="font-mono">{result.rows.length}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Migration Eligibility */}
                    <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3">Migration Eligibility</h3>
                      {isMigrationEligible(lastQueryType) ? (
                        <div className="flex items-start gap-2 text-xs">
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-green-400 mb-1">This query can be saved as a migration</p>
                            <p className="text-app-text-dim">
                              DDL statements (CREATE, ALTER, DROP) can be versioned as migrations.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-xs">
                          <AlertCircle className="w-4 h-4 text-app-text-dim flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-app-text-dim mb-1">This query cannot be saved as a migration</p>
                            <p className="text-app-text-dim">
                              Only DDL statements (CREATE, ALTER, DROP) can be migrations.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Editor Features */}
                    <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3">Editor Features</h3>
                      <div className="space-y-2 text-xs text-app-text-dim">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          SQL autocomplete enabled
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          Press Ctrl+Space for suggestions
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          Hover over keywords for documentation
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          Schema-aware column suggestions
                        </div>
                      </div>
                    </div>

                    {/* System Info */}
                    <div className="bg-app-sidebar border border-app-border rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3">System Information</h3>
                      <div className="space-y-1 text-xs text-app-text-dim">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5" />
                          SQLite 3.44.0
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5" />
                          Monaco Editor
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save as Migration Modal */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowMigrationModal(false)}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Save as Migration</h2>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                Migration Name
              </label>
              <input
                type="text"
                value={migrationName}
                onChange={(e) => setMigrationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !savingMigration) {
                    handleCreateMigration()
                  }
                }}
                placeholder="e.g., add_users_table or create_indexes"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
                autoFocus
              />
              <p className="text-xs text-app-text-dim mt-1">
                The migration will be automatically numbered (e.g., 001_your_name.sql)
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                SQL Preview
              </label>
              <pre className="text-xs bg-app-bg border border-app-border rounded p-3 max-h-40 overflow-auto font-mono">
                {editorState.sql}
              </pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMigrationModal(false)
                  setMigrationName('')
                }}
                disabled={savingMigration}
                className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMigration}
                disabled={savingMigration || !migrationName.trim()}
                className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors"
              >
                {savingMigration ? 'Creating...' : 'Create Migration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Favorite Modal */}
      {showFavoriteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowFavoriteModal(false)}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Save as Favorite</h2>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                Favorite Name
              </label>
              <input
                type="text"
                value={favoriteName}
                onChange={(e) => setFavoriteName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFavorite()
                  }
                }}
                placeholder="e.g., Get all users or Common joins"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                SQL Preview
              </label>
              <pre className="text-xs bg-app-bg border border-app-border rounded p-3 max-h-40 overflow-auto font-mono">
                {selectedSQL}
              </pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowFavoriteModal(false)
                  setFavoriteName('')
                  setSelectedSQL('')
                }}
                className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFavorite}
                disabled={!favoriteName.trim()}
                className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors"
              >
                Save Favorite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Take Snapshot Modal */}
      {showSnapshotModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowSnapshotModal(false)}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Take Snapshot
            </h2>

            <p className="text-sm text-app-text-dim mb-4">
              Create a point-in-time snapshot of your database. You can restore to this state later.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">
                Snapshot Name (Optional)
              </label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creatingSnapshot) {
                    handleCreateSnapshot()
                  }
                }}
                placeholder="e.g., before_migration or stable_v1"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
                autoFocus
              />
              <p className="text-xs text-app-text-dim mt-1">
                Leave empty to auto-generate a timestamp-based name
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSnapshotModal(false)
                  setSnapshotName('')
                }}
                disabled={creatingSnapshot}
                className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover disabled:opacity-50 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSnapshot}
                disabled={creatingSnapshot}
                className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors flex items-center gap-2"
              >
                {creatingSnapshot ? (
                  <>Creating...</>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Create Snapshot
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Context Menu (Right-click save options) */}
      {tabContextMenu && (
        <div
          className="fixed bg-app-sidebar border border-app-border rounded-lg shadow-lg overflow-hidden z-50"
          style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs text-app-text-dim border-b border-app-border">Save As...</div>
          <button
            onClick={() => {
              const tab = queryTabs.find(t => t.id === tabContextMenu.tabId)
              if (!tab?.sql?.trim()) {
                toast.error('Cannot save empty query')
                setTabContextMenu(null)
                return
              }
              setSaveModal({ type: 'favorite', sql: tab.sql })
              setSaveItemName(tab.name !== 'Untitled query' ? tab.name : '')
              setSelectedFolderPath([])
              setTabContextMenu(null)
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-app-sidebar-hover flex items-center gap-2"
          >
            <Star className="w-4 h-4 text-yellow-400" />
            <span>Save as Favorite</span>
          </button>
          <button
            onClick={() => {
              const tab = queryTabs.find(t => t.id === tabContextMenu.tabId)
              if (!tab?.sql?.trim()) {
                toast.error('Cannot save empty query')
                setTabContextMenu(null)
                return
              }
              setSaveModal({ type: 'template', sql: tab.sql })
              setSaveItemName(tab.name !== 'Untitled query' ? tab.name : '')
              setSelectedFolderPath([])
              setTabContextMenu(null)
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-app-sidebar-hover flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Save as Template</span>
          </button>
          <button
            onClick={() => {
              const tab = queryTabs.find(t => t.id === tabContextMenu.tabId)
              if (!tab?.sql?.trim()) {
                toast.error('Cannot save empty query')
                setTabContextMenu(null)
                return
              }
              setSaveModal({ type: 'private', sql: tab.sql })
              setSaveItemName(tab.name !== 'Untitled query' ? tab.name : '')
              setSelectedFolderPath([])
              setTabContextMenu(null)
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-app-sidebar-hover flex items-center gap-2"
          >
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Save as Private</span>
          </button>
        </div>
      )}

      {/* Save Modal */}
      {saveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setSaveModal(null); setSelectedFolderPath([]); }}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              {saveModal.type === 'favorite' && <Star className="w-5 h-5 text-yellow-400" />}
              {saveModal.type === 'template' && <FileText className="w-5 h-5 text-blue-400" />}
              {saveModal.type === 'private' && <Lock className="w-5 h-5 text-purple-400" />}
              Save as {saveModal.type.charAt(0).toUpperCase() + saveModal.type.slice(1)}
            </h2>

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">Name</label>
              <input
                type="text"
                value={saveItemName}
                onChange={(e) => setSaveItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && saveItemName.trim()) {
                    handleSaveAs(saveModal.type)
                  }
                }}
                placeholder="Enter a name for this query..."
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
                autoFocus
              />
            </div>

            {/* Folder selection dropdowns */}
            {(() => {
              const sectionItems = getCurrentSectionItems(saveModal.type)
              const foldersAtRoot = sectionItems.filter(item => item.type === 'folder')
              
              if (foldersAtRoot.length === 0) return null

              // Build nested folder dropdowns
              const dropdowns: React.ReactNode[] = []
              
              // Root folder dropdown
              dropdowns.push(
                <select
                  key="root"
                  value={selectedFolderPath[0] || ''}
                  onChange={(e) => {
                    if (e.target.value === '') {
                      setSelectedFolderPath([])
                    } else {
                      setSelectedFolderPath([e.target.value])
                    }
                  }}
                  className="bg-app-bg border border-app-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-app-accent min-w-[100px]"
                >
                  <option value="">Root</option>
                  {foldersAtRoot.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.label}</option>
                  ))}
                </select>
              )

              // Add nested dropdowns for each selected folder level
              let currentItems = sectionItems
              for (let i = 0; i < selectedFolderPath.length; i++) {
                const folderId = selectedFolderPath[i]
                const folder = currentItems.find(item => item.id === folderId && item.type === 'folder')
                
                if (!folder?.children) break
                
                const subfolders = folder.children.filter((item: any) => item.type === 'folder')
                if (subfolders.length === 0) break

                const pathIndex = i + 1
                dropdowns.push(
                  <ChevronRight key={`arrow-${i}`} className="w-4 h-4 text-app-text-dim flex-shrink-0" />,
                  <select
                    key={`level-${pathIndex}`}
                    value={selectedFolderPath[pathIndex] || ''}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setSelectedFolderPath(prev => prev.slice(0, pathIndex))
                      } else {
                        setSelectedFolderPath(prev => [...prev.slice(0, pathIndex), e.target.value])
                      }
                    }}
                    className="bg-app-bg border border-app-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-app-accent min-w-[100px]"
                  >
                    <option value="">{folder.label}</option>
                    {subfolders.map((subfolder: any) => (
                      <option key={subfolder.id} value={subfolder.id}>{subfolder.label}</option>
                    ))}
                  </select>
                )

                currentItems = folder.children
              }

              return (
                <div className="mb-4">
                  <label className="block text-sm text-app-text-dim mb-2">Location (optional)</label>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Folder className="w-4 h-4 text-app-text-dim flex-shrink-0 mr-1" />
                    {dropdowns}
                  </div>
                </div>
              )
            })()}

            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">Preview</label>
              <div className="bg-app-bg border border-app-border rounded p-2 text-xs font-mono max-h-24 overflow-auto">
                {saveModal.sql.slice(0, 200)}{saveModal.sql.length > 200 ? '...' : ''}
              </div>
            </div>

            {/* Save type selector */}
            <div className="mb-4">
              <label className="block text-sm text-app-text-dim mb-2">Save to</label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSaveModal({ ...saveModal, type: 'favorite' }); setSelectedFolderPath([]); }}
                  className={`flex-1 px-3 py-2 text-xs rounded flex items-center justify-center gap-2 transition-colors ${saveModal.type === 'favorite' ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400' : 'bg-app-bg border border-app-border hover:bg-app-sidebar-hover'}`}
                >
                  <Star className="w-3.5 h-3.5" />
                  Favorite
                </button>
                <button
                  onClick={() => { setSaveModal({ ...saveModal, type: 'template' }); setSelectedFolderPath([]); }}
                  className={`flex-1 px-3 py-2 text-xs rounded flex items-center justify-center gap-2 transition-colors ${saveModal.type === 'template' ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400' : 'bg-app-bg border border-app-border hover:bg-app-sidebar-hover'}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Template
                </button>
                <button
                  onClick={() => { setSaveModal({ ...saveModal, type: 'private' }); setSelectedFolderPath([]); }}
                  className={`flex-1 px-3 py-2 text-xs rounded flex items-center justify-center gap-2 transition-colors ${saveModal.type === 'private' ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400' : 'bg-app-bg border border-app-border hover:bg-app-sidebar-hover'}`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Private
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setSaveModal(null); setSelectedFolderPath([]); }}
                className="px-4 py-2 text-sm bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveAs(saveModal.type)}
                disabled={!saveItemName.trim()}
                className="px-4 py-2 text-sm bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}