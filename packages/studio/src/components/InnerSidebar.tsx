'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppContext } from '@/contexts/AppContext'
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  Star,
  Plus,
  MoreVertical,
  Copy,
  Trash2,
  Edit,
  FolderPlus
} from 'lucide-react'

interface SnippetItem {
  id: string
  label: string
  type: 'file' | 'folder'
  sql?: string
  children?: SnippetItem[]
  parentId?: string
}

interface InnerSidebarProps {
  width?: string
}

export default function InnerSidebar({ width = '240px' }: InnerSidebarProps) {
  const { updateSQL } = useAppContext()
  const [favorites, setFavorites] = useState<SnippetItem[]>([])
  const [templates, setTemplates] = useState<SnippetItem[]>([])

  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false)
  const [templatesCollapsed, setTemplatesCollapsed] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: SnippetItem; section: 'favorites' | 'templates' } | null>(null)
  const [draggedItem, setDraggedItem] = useState<{ item: SnippetItem; section: 'favorites' | 'templates' } | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    loadFavorites()
    loadTemplates()

    // Listen for storage changes
    const handleStorageChange = () => {
      loadFavorites()
      loadTemplates()
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  function loadFavorites() {
    const savedFavorites = localStorage.getItem('localdb-favorites')
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites))
      } catch (e) {
        console.error('Failed to load favorites', e)
      }
    }
  }

  function loadTemplates() {
    const savedTemplates = localStorage.getItem('localdb-templates')
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates))
      } catch (e) {
        console.error('Failed to load templates', e)
      }
    }
  }

  // Save to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('localdb-favorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem('localdb-templates', JSON.stringify(templates))
  }, [templates])

  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  function handleContextMenu(e: React.MouseEvent, item: SnippetItem, section: 'favorites' | 'templates') {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, item, section })
  }

  function handleDragStart(item: SnippetItem, section: 'favorites' | 'templates') {
    setDraggedItem({ item, section })
  }

  function handleDrop(targetItem: SnippetItem, targetSection: 'favorites' | 'templates') {
    if (!draggedItem) return

    // Handle drop logic here
    console.log('Drop', draggedItem.item.label, 'onto', targetItem.label)
    setDraggedItem(null)
  }

  function handleAddSnippet(section: 'favorites' | 'templates') {
    const newSnippet: SnippetItem = {
      id: `snippet-${Date.now()}`,
      label: 'New snippet',
      type: 'file',
      sql: '-- Write your SQL here'
    }

    if (section === 'favorites') {
      setFavorites([...favorites, newSnippet])
    } else {
      setTemplates([...templates, newSnippet])
    }
  }

  function handleAddFolder(section: 'favorites' | 'templates') {
    const newFolder: SnippetItem = {
      id: `folder-${Date.now()}`,
      label: 'New folder',
      type: 'folder',
      children: []
    }

    if (section === 'favorites') {
      setFavorites([...favorites, newFolder])
    } else {
      setTemplates([...templates, newFolder])
    }
  }

  function handleCopy() {
    if (contextMenu) {
      console.log('Copy', contextMenu.item.label)
      // Implement copy logic
      setContextMenu(null)
    }
  }

  function handleRename() {
    if (contextMenu) {
      const newName = prompt('Enter new name:', contextMenu.item.label)
      if (newName) {
        // Implement rename logic
        console.log('Rename', contextMenu.item.label, 'to', newName)
      }
      setContextMenu(null)
    }
  }

  function handleDelete() {
    if (contextMenu) {
      if (confirm(`Delete "${contextMenu.item.label}"?`)) {
        if (contextMenu.section === 'favorites') {
          setFavorites(favorites.filter(f => f.id !== contextMenu.item.id))
        } else {
          // Handle nested deletion in templates
          const deleteFromArray = (items: SnippetItem[]): SnippetItem[] => {
            return items.filter(item => {
              if (item.id === contextMenu.item.id) return false
              if (item.children) {
                item.children = deleteFromArray(item.children)
              }
              return true
            })
          }
          setTemplates(deleteFromArray(templates))
        }
      }
      setContextMenu(null)
    }
  }

  function renderItem(
    item: SnippetItem,
    section: 'favorites' | 'templates',
    depth: number = 0
  ) {
    const isFolder = item.type === 'folder'
    const isExpanded = expandedFolders.has(item.id)

    function handleClick() {
      if (isFolder) {
        toggleFolder(item.id)
      } else if (item.sql) {
        // Load SQL into editor when clicking on a file
        updateSQL(item.sql)
      }
    }

    return (
      <div key={item.id}>
        <div
          draggable={!isFolder}
          onDragStart={() => handleDragStart(item, section)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(item, section)}
          onContextMenu={(e) => handleContextMenu(e, item, section)}
          onClick={handleClick}
          className={`
            flex items-center justify-between px-2 py-1.5 text-sm rounded
            transition-colors cursor-pointer group
            hover:bg-app-sidebar-hover
          `}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isFolder ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-app-text-dim" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-app-text-dim" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 flex-shrink-0 text-app-text-dim" />
                ) : (
                  <Folder className="w-4 h-4 flex-shrink-0 text-app-text-dim" />
                )}
              </>
            ) : (
              <>
                <div className="w-3.5" /> {/* Spacer for alignment */}
                <FileCode className="w-4 h-4 flex-shrink-0 text-app-text-dim" />
              </>
            )}
            <span className="truncate text-app-text">{item.label}</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              handleContextMenu(e, item, section)
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-app-sidebar-active rounded"
          >
            <MoreVertical className="w-3.5 h-3.5 text-app-text-dim" />
          </button>
        </div>

        {/* Render children if folder is expanded */}
        {isFolder && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderItem(child, section, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="bg-app-sidebar border-r border-app-border overflow-y-auto flex-shrink-0"
      style={{ width }}
      onClick={() => setContextMenu(null)}
    >
      <div className="p-2">
        {/* Favorites Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <button
              onClick={() => setFavoritesCollapsed(!favoritesCollapsed)}
              className="flex items-center gap-2 text-xs text-app-text-dim hover:text-app-text transition-colors"
            >
              {favoritesCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <Star className="w-3.5 h-3.5" />
              <span className="font-medium uppercase tracking-wide">Favorites</span>
            </button>

            {!favoritesCollapsed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddSnippet('favorites')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title="Add snippet"
                >
                  <Plus className="w-3.5 h-3.5 text-app-text-dim" />
                </button>
                <button
                  onClick={() => handleAddFolder('favorites')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title="Add folder"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-app-text-dim" />
                </button>
              </div>
            )}
          </div>

          {!favoritesCollapsed && (
            <div className="space-y-0.5">
              {favorites.length === 0 ? (
                <div className="px-2 py-4 text-xs text-app-text-dim text-center">
                  No favorites yet
                </div>
              ) : (
                favorites.map(item => renderItem(item, 'favorites'))
              )}
            </div>
          )}
        </div>

        {/* Templates Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <button
              onClick={() => setTemplatesCollapsed(!templatesCollapsed)}
              className="flex items-center gap-2 text-xs text-app-text-dim hover:text-app-text transition-colors"
            >
              {templatesCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <FileCode className="w-3.5 h-3.5" />
              <span className="font-medium uppercase tracking-wide">Templates</span>
            </button>

            {!templatesCollapsed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddSnippet('templates')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title="Add snippet"
                >
                  <Plus className="w-3.5 h-3.5 text-app-text-dim" />
                </button>
                <button
                  onClick={() => handleAddFolder('templates')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title="Add folder"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-app-text-dim" />
                </button>
              </div>
            )}
          </div>

          {!templatesCollapsed && (
            <div className="space-y-0.5">
              {templates.map(item => renderItem(item, 'templates'))}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-app-sidebar border border-app-border rounded-lg shadow-lg overflow-hidden z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleCopy}
            className="w-full px-3 py-2 text-left text-sm hover:bg-app-sidebar-hover flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            <span>Copy</span>
          </button>
          <button
            onClick={handleRename}
            className="w-full px-3 py-2 text-left text-sm hover:bg-app-sidebar-hover flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            <span>Rename</span>
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/10 text-red-400 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  )
}
