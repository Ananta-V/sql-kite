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
  FolderPlus,
  Lock,
  FolderLock
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
  disabled?: boolean
  privateItems?: SnippetItem[]
  onPrivateItemsChange?: (items: SnippetItem[]) => void
  onPrivateItemClick?: (item: SnippetItem) => void
}

export default function InnerSidebar({ 
  width = '240px', 
  disabled = false,
  privateItems = [],
  onPrivateItemsChange,
  onPrivateItemClick
}: InnerSidebarProps) {
  const { updateSQL } = useAppContext()
  const disableTitle = 'Disabled in Compare Mode'
  const [favorites, setFavorites] = useState<SnippetItem[]>([])
  const [templates, setTemplates] = useState<SnippetItem[]>([])

  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false)
  const [templatesCollapsed, setTemplatesCollapsed] = useState(false)
  const [privateCollapsed, setPrivateCollapsed] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: SnippetItem; section: 'favorites' | 'templates' | 'private' } | null>(null)
  const [draggedItem, setDraggedItem] = useState<{ item: SnippetItem; section: 'favorites' | 'templates' | 'private' } | null>(null)
  
  // Rename modal state
  const [renameModal, setRenameModal] = useState<{ item: SnippetItem; section: 'favorites' | 'templates' | 'private' } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  
  // Delete confirm modal state
  const [deleteModal, setDeleteModal] = useState<{ item: SnippetItem; section: 'favorites' | 'templates' | 'private' } | null>(null)

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

  function handleContextMenu(e: React.MouseEvent, item: SnippetItem, section: 'favorites' | 'templates' | 'private') {
    if (disabled) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, item, section })
  }

  function handleDragStart(item: SnippetItem, section: 'favorites' | 'templates' | 'private') {
    if (disabled) return
    setDraggedItem({ item, section })
  }

  function handleDrop(targetItem: SnippetItem, targetSection: 'favorites' | 'templates' | 'private') {
    if (disabled) return
    if (!draggedItem) return

    // Handle drop logic here
    console.log('Drop', draggedItem.item.label, 'onto', targetItem.label)
    setDraggedItem(null)
  }

  function handleAddSnippet(section: 'favorites' | 'templates' | 'private') {
    if (disabled) return
    const newSnippet: SnippetItem = {
      id: `snippet-${Date.now()}`,
      label: 'New snippet',
      type: 'file',
      sql: '-- Write your SQL here'
    }

    if (section === 'favorites') {
      setFavorites([...favorites, newSnippet])
    } else if (section === 'templates') {
      setTemplates([...templates, newSnippet])
    } else if (section === 'private' && onPrivateItemsChange) {
      onPrivateItemsChange([...privateItems, newSnippet])
    }
  }

  function handleAddFolder(section: 'favorites' | 'templates' | 'private') {
    if (disabled) return
    const newFolder: SnippetItem = {
      id: `folder-${Date.now()}`,
      label: 'New folder',
      type: 'folder',
      children: []
    }

    if (section === 'favorites') {
      setFavorites([...favorites, newFolder])
    } else if (section === 'templates') {
      setTemplates([...templates, newFolder])
    } else if (section === 'private' && onPrivateItemsChange) {
      onPrivateItemsChange([...privateItems, newFolder])
    }
  }

  function handleCopy() {
    if (contextMenu) {
      if (contextMenu.item.sql) {
        navigator.clipboard.writeText(contextMenu.item.sql)
      }
      setContextMenu(null)
    }
  }

  function handleRename() {
    if (contextMenu) {
      setRenameValue(contextMenu.item.label)
      setRenameModal({ item: contextMenu.item, section: contextMenu.section })
      setContextMenu(null)
    }
  }

  function confirmRename() {
    if (!renameModal || !renameValue.trim()) return
    
    const updateItemName = (items: SnippetItem[]): SnippetItem[] => {
      return items.map(item => {
        if (item.id === renameModal.item.id) {
          return { ...item, label: renameValue.trim() }
        }
        if (item.children) {
          return { ...item, children: updateItemName(item.children) }
        }
        return item
      })
    }

    if (renameModal.section === 'favorites') {
      setFavorites(updateItemName(favorites))
    } else if (renameModal.section === 'templates') {
      setTemplates(updateItemName(templates))
    } else if (renameModal.section === 'private' && onPrivateItemsChange) {
      onPrivateItemsChange(updateItemName(privateItems))
    }
    
    setRenameModal(null)
    setRenameValue('')
  }

  function handleDelete() {
    if (contextMenu) {
      setDeleteModal({ item: contextMenu.item, section: contextMenu.section })
      setContextMenu(null)
    }
  }

  function confirmDelete() {
    if (!deleteModal) return
    
    const deleteFromArray = (items: SnippetItem[]): SnippetItem[] => {
      return items.filter(item => {
        if (item.id === deleteModal.item.id) return false
        if (item.children) {
          item.children = deleteFromArray(item.children)
        }
        return true
      })
    }

    if (deleteModal.section === 'favorites') {
      setFavorites(deleteFromArray(favorites))
    } else if (deleteModal.section === 'templates') {
      setTemplates(deleteFromArray(templates))
    } else if (deleteModal.section === 'private' && onPrivateItemsChange) {
      onPrivateItemsChange(deleteFromArray(privateItems))
    }
    
    setDeleteModal(null)
  }

  function renderItem(
    item: SnippetItem,
    section: 'favorites' | 'templates' | 'private',
    depth: number = 0
  ) {
    const isFolder = item.type === 'folder'
    const isExpanded = expandedFolders.has(item.id)

    function handleClick() {
      if (disabled) return
      if (isFolder) {
        toggleFolder(item.id)
      } else if (section === 'private' && onPrivateItemClick) {
        onPrivateItemClick(item)
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
          title={disabled ? disableTitle : undefined}
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
            disabled={disabled}
            title={disabled ? disableTitle : undefined}
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
      className={`bg-app-sidebar border-r border-app-border overflow-y-auto flex-shrink-0 ${disabled ? 'opacity-70' : ''}`}
      style={{ width }}
      onClick={() => setContextMenu(null)}
    >
      <div className="p-2">
        {/* Favorites Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <button
              onClick={() => {
                if (!disabled) setFavoritesCollapsed(!favoritesCollapsed)
              }}
              className="flex items-center gap-2 text-xs text-app-text-dim hover:text-app-text transition-colors"
              title={disabled ? disableTitle : undefined}
            >
              {favoritesCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <Star className="w-3.5 h-3.5" />
              <span className="font-medium uppercase tracking-wide">Favorites</span>
              {disabled && <Lock className="w-3 h-3 text-app-text-dim" />}
            </button>

            {!favoritesCollapsed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddSnippet('favorites')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title={disabled ? disableTitle : 'Add snippet'}
                  disabled={disabled}
                >
                  <Plus className="w-3.5 h-3.5 text-app-text-dim" />
                </button>
                <button
                  onClick={() => handleAddFolder('favorites')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title={disabled ? disableTitle : 'Add folder'}
                  disabled={disabled}
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
              onClick={() => {
                if (!disabled) setTemplatesCollapsed(!templatesCollapsed)
              }}
              className="flex items-center gap-2 text-xs text-app-text-dim hover:text-app-text transition-colors"
              title={disabled ? disableTitle : undefined}
            >
              {templatesCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <FileCode className="w-3.5 h-3.5" />
              <span className="font-medium uppercase tracking-wide">Templates</span>
              {disabled && <Lock className="w-3 h-3 text-app-text-dim" />}
            </button>

            {!templatesCollapsed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddSnippet('templates')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title={disabled ? disableTitle : 'Add snippet'}
                  disabled={disabled}
                >
                  <Plus className="w-3.5 h-3.5 text-app-text-dim" />
                </button>
                <button
                  onClick={() => handleAddFolder('templates')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title={disabled ? disableTitle : 'Add folder'}
                  disabled={disabled}
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

        {/* Private Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <button
              onClick={() => {
                if (!disabled) setPrivateCollapsed(!privateCollapsed)
              }}
              className="flex items-center gap-2 text-xs text-app-text-dim hover:text-app-text transition-colors"
              title={disabled ? disableTitle : undefined}
            >
              {privateCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <FolderLock className="w-3.5 h-3.5" />
              <span className="font-medium uppercase tracking-wide">Private</span>
              {disabled && <Lock className="w-3 h-3 text-app-text-dim" />}
            </button>

            {!privateCollapsed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddSnippet('private')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title={disabled ? disableTitle : 'Add snippet'}
                  disabled={disabled}
                >
                  <Plus className="w-3.5 h-3.5 text-app-text-dim" />
                </button>
                <button
                  onClick={() => handleAddFolder('private')}
                  className="p-1 hover:bg-app-sidebar-hover rounded transition-colors"
                  title={disabled ? disableTitle : 'Add folder'}
                  disabled={disabled}
                >
                  <FolderPlus className="w-3.5 h-3.5 text-app-text-dim" />
                </button>
              </div>
            )}
          </div>

          {!privateCollapsed && (
            <div className="space-y-0.5">
              {privateItems.length === 0 ? (
                <div className="px-2 py-4 text-xs text-app-text-dim text-center">
                  No private queries yet
                </div>
              ) : (
                privateItems.map(item => renderItem(item, 'private'))
              )}
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

      {/* Rename Modal */}
      {renameModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setRenameModal(null)}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Rename</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename()
                if (e.key === 'Escape') setRenameModal(null)
              }}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:border-app-accent"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRenameModal(null)}
                className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRename}
                disabled={!renameValue.trim()}
                className="px-3 py-1.5 text-xs bg-app-accent hover:bg-app-accent-hover disabled:opacity-50 text-white rounded transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteModal(null)}>
          <div className="bg-app-sidebar border border-app-border rounded-lg p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Delete "{deleteModal.item.label}"?</h3>
            <p className="text-xs text-app-text-dim mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-3 py-1.5 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
