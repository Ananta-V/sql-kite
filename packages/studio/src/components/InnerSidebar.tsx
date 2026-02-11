'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppContext } from '@/contexts/AppContext'
import { toast } from 'react-toastify'
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  Star,
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
  onOpenFile?: (item: SnippetItem, section: 'favorites' | 'templates' | 'private') => void
}

export default function InnerSidebar({ 
  width = '240px', 
  disabled = false,
  privateItems = [],
  onPrivateItemsChange,
  onOpenFile
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
  const [dragOverTarget, setDragOverTarget] = useState<{ type: 'section' | 'folder'; id: string } | null>(null)
  
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

  function handleDragStart(e: React.DragEvent, item: SnippetItem, section: 'favorites' | 'templates' | 'private') {
    if (disabled) return
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem({ item, section })
  }

  function handleDragEnd() {
    setDraggedItem(null)
    setDragOverTarget(null)
  }

  // Check if an item is a descendant of a folder
  function isDescendant(folderId: string, itemId: string, items: SnippetItem[]): boolean {
    for (const item of items) {
      if (item.id === folderId && item.type === 'folder' && item.children) {
        // Check if itemId is directly in children or deeper
        const found = item.children.some(child => 
          child.id === itemId || (child.type === 'folder' && isDescendant(child.id, itemId, [child]))
        )
        if (found) return true
      }
      if (item.children) {
        if (isDescendant(folderId, itemId, item.children)) return true
      }
    }
    return false
  }

  // Remove item from its current location
  function removeItem(items: SnippetItem[], itemId: string): SnippetItem[] {
    return items.filter(item => {
      if (item.id === itemId) return false
      if (item.children) {
        item.children = removeItem(item.children, itemId)
      }
      return true
    }).map(item => ({ ...item }))
  }

  // Add item to a folder or root
  function addItemToFolder(items: SnippetItem[], targetFolderId: string | null, newItem: SnippetItem): SnippetItem[] {
    if (targetFolderId === null) {
      // Add to root
      return [...items, newItem]
    }

    return items.map(item => {
      if (item.id === targetFolderId && item.type === 'folder') {
        return {
          ...item,
          children: [...(item.children || []), newItem]
        }
      }
      if (item.children) {
        return {
          ...item,
          children: addItemToFolder(item.children, targetFolderId, newItem)
        }
      }
      return item
    })
  }

  // Get items for a section
  function getSectionItems(section: 'favorites' | 'templates' | 'private'): SnippetItem[] {
    if (section === 'favorites') return favorites
    if (section === 'templates') return templates
    return privateItems
  }

  // Set items for a section
  function setSectionItems(section: 'favorites' | 'templates' | 'private', items: SnippetItem[]) {
    if (section === 'favorites') setFavorites(items)
    else if (section === 'templates') setTemplates(items)
    else if (section === 'private' && onPrivateItemsChange) onPrivateItemsChange(items)
  }

  // Handle drop onto a folder
  function handleDropOnFolder(targetFolder: SnippetItem, targetSection: 'favorites' | 'templates' | 'private') {
    if (disabled || !draggedItem) return

    const { item: sourceItem, section: sourceSection } = draggedItem

    // Prevent dropping on itself
    if (sourceItem.id === targetFolder.id) {
      setDraggedItem(null)
      setDragOverTarget(null)
      return
    }

    // Prevent dropping a folder into its own descendant
    if (sourceItem.type === 'folder') {
      const targetItems = getSectionItems(targetSection)
      if (isDescendant(sourceItem.id, targetFolder.id, targetItems)) {
        toast.error("Cannot move folder into its own subfolder")
        setDraggedItem(null)
        setDragOverTarget(null)
        return
      }
    }

    // Clone the source item
    const itemToMove: SnippetItem = JSON.parse(JSON.stringify(sourceItem))

    // Remove from source
    const sourceItems = getSectionItems(sourceSection)
    const updatedSourceItems = removeItem(sourceItems, sourceItem.id)

    if (sourceSection === targetSection) {
      // Same section: remove and add
      const finalItems = addItemToFolder(updatedSourceItems, targetFolder.id, itemToMove)
      setSectionItems(sourceSection, finalItems)
    } else {
      // Different sections: remove from source, add to target
      setSectionItems(sourceSection, updatedSourceItems)
      const targetItems = getSectionItems(targetSection)
      const updatedTargetItems = addItemToFolder(targetItems, targetFolder.id, itemToMove)
      setSectionItems(targetSection, updatedTargetItems)
    }

    toast.success(`Moved "${sourceItem.label}" to "${targetFolder.label}"`)
    setDraggedItem(null)
    setDragOverTarget(null)
  }

  // Handle drop onto section header (root)
  function handleDropOnSection(targetSection: 'favorites' | 'templates' | 'private') {
    if (disabled || !draggedItem) return

    const { item: sourceItem, section: sourceSection } = draggedItem

    // Clone the source item
    const itemToMove: SnippetItem = JSON.parse(JSON.stringify(sourceItem))

    // Remove from source
    const sourceItems = getSectionItems(sourceSection)
    const updatedSourceItems = removeItem(sourceItems, sourceItem.id)

    if (sourceSection === targetSection) {
      // Same section: just move to root level
      const finalItems = [...updatedSourceItems, itemToMove]
      setSectionItems(sourceSection, finalItems)
    } else {
      // Different sections: remove from source, add to target root
      setSectionItems(sourceSection, updatedSourceItems)
      const targetItems = getSectionItems(targetSection)
      const updatedTargetItems = [...targetItems, itemToMove]
      setSectionItems(targetSection, updatedTargetItems)
    }

    const sectionNames = { favorites: 'Favorites', templates: 'Templates', private: 'Private' }
    toast.success(`Moved "${sourceItem.label}" to ${sectionNames[targetSection]}`)
    setDraggedItem(null)
    setDragOverTarget(null)
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
    const isDragOver = dragOverTarget?.type === 'folder' && dragOverTarget.id === item.id
    const isDragging = draggedItem?.item.id === item.id

    function handleClick() {
      if (disabled) return
      if (isFolder) {
        toggleFolder(item.id)
      } else if (item.sql && onOpenFile) {
        // Open file in a new tab
        onOpenFile(item, section)
      }
    }

    return (
      <div key={item.id}>
        <div
          draggable={!disabled}
          onDragStart={(e) => handleDragStart(e, item, section)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (isFolder && draggedItem && draggedItem.item.id !== item.id) {
              setDragOverTarget({ type: 'folder', id: item.id })
            }
          }}
          onDragLeave={(e) => {
            e.stopPropagation()
            if (dragOverTarget?.id === item.id) {
              setDragOverTarget(null)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (isFolder) {
              handleDropOnFolder(item, section)
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, item, section)}
          onClick={handleClick}
          className={`
            relative flex items-center justify-between px-2 py-1.5 text-sm rounded
            transition-colors cursor-pointer group
            ${isDragging ? 'opacity-50' : ''}
            ${isDragOver && isFolder ? 'bg-app-accent/20 ring-1 ring-app-accent' : 'hover:bg-app-sidebar-hover'}
          `}
          title={disabled ? disableTitle : undefined}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Horizontal connector line for nested items */}
            {depth > 0 && (
              <div 
                className="absolute h-px bg-app-border/50" 
                style={{ 
                  left: `${14 + (depth - 1) * 12}px`, 
                  width: '8px' 
                }} 
              />
            )}
            {isFolder ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-app-text-dim" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-app-text-dim" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 flex-shrink-0 text-yellow-500/70" />
                ) : (
                  <Folder className="w-4 h-4 flex-shrink-0 text-yellow-500/70" />
                )}
              </>
            ) : (
              <>
                <div className="w-3.5" /> {/* Spacer for alignment */}
                <FileCode className="w-4 h-4 flex-shrink-0 text-blue-400/70" />
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
          <div
            className={`relative ${
              dragOverTarget?.type === 'folder' && dragOverTarget.id === item.id 
                ? 'bg-app-accent/10' 
                : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (draggedItem && draggedItem.item.id !== item.id) {
                setDragOverTarget({ type: 'folder', id: item.id })
              }
            }}
            onDragLeave={(e) => {
              // Only clear if leaving the container entirely
              const rect = e.currentTarget.getBoundingClientRect()
              const x = e.clientX
              const y = e.clientY
              if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                if (dragOverTarget?.id === item.id) {
                  setDragOverTarget(null)
                }
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleDropOnFolder(item, section)
            }}
          >
            {/* Tree line for visual hierarchy */}
            <div 
              className="absolute left-0 top-0 bottom-0 border-l border-app-border/50"
              style={{ marginLeft: `${14 + depth * 12}px` }}
            />
            {item.children.length === 0 ? (
              <div 
                className="py-2 text-xs text-app-text-dim italic"
                style={{ paddingLeft: `${20 + depth * 12}px` }}
              >
                Drop items here
              </div>
            ) : (
              item.children.map(child => renderItem(child, section, depth + 1))
            )}
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
        <div 
          className="mb-4"
          onDragOver={(e) => {
            e.preventDefault()
            if (draggedItem) {
              setDragOverTarget({ type: 'section', id: 'favorites' })
            }
          }}
          onDragLeave={() => {
            if (dragOverTarget?.id === 'favorites') {
              setDragOverTarget(null)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDropOnSection('favorites')
          }}
        >
          <div 
            className={`flex items-center justify-between px-2 py-1.5 mb-1 rounded transition-colors ${
              dragOverTarget?.type === 'section' && dragOverTarget.id === 'favorites' 
                ? 'bg-yellow-500/20 ring-1 ring-yellow-500/50' 
                : ''
            }`}
          >
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
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (draggedItem) {
              setDragOverTarget({ type: 'section', id: 'templates' })
            }
          }}
          onDragLeave={() => {
            if (dragOverTarget?.id === 'templates') {
              setDragOverTarget(null)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDropOnSection('templates')
          }}
        >
          <div 
            className={`flex items-center justify-between px-2 py-1.5 mb-1 rounded transition-colors ${
              dragOverTarget?.type === 'section' && dragOverTarget.id === 'templates' 
                ? 'bg-blue-500/20 ring-1 ring-blue-500/50' 
                : ''
            }`}
          >
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
              {templates.length === 0 ? (
                <div className="px-2 py-4 text-xs text-app-text-dim text-center">
                  No templates yet
                </div>
              ) : (
                templates.map(item => renderItem(item, 'templates'))
              )}
            </div>
          )}
        </div>

        {/* Private Section */}
        <div 
          className="mt-4"
          onDragOver={(e) => {
            e.preventDefault()
            if (draggedItem) {
              setDragOverTarget({ type: 'section', id: 'private' })
            }
          }}
          onDragLeave={() => {
            if (dragOverTarget?.id === 'private') {
              setDragOverTarget(null)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDropOnSection('private')
          }}
        >
          <div 
            className={`flex items-center justify-between px-2 py-1.5 mb-1 rounded transition-colors ${
              dragOverTarget?.type === 'section' && dragOverTarget.id === 'private' 
                ? 'bg-purple-500/20 ring-1 ring-purple-500/50' 
                : ''
            }`}
          >
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
