'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface EditorState {
  sql: string
  activeTab: 'result' | 'errors' | 'info'
}

interface Favorite {
  id: string
  label: string
  sql: string
}

interface AppContextType {
  // SQL Editor State
  editorState: EditorState
  setEditorState: (state: EditorState) => void
  updateSQL: (sql: string) => void
  updateActiveTab: (tab: 'result' | 'errors' | 'info') => void

  // Favorites
  addFavorite: (name: string, sql: string) => void

  // Project Info
  projectInfo: any
  setProjectInfo: (info: any) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [projectInfo, setProjectInfo] = useState<any>(null)
  const [editorState, setEditorStateInternal] = useState<EditorState>({
    sql: '-- Write your SQL query here\n\n-- Press Ctrl+Space for autocomplete\n',
    activeTab: 'result'
  })

  // Load SQL from localStorage on mount
  useEffect(() => {
    const savedSQL = localStorage.getItem('localdb-sql-editor-content')
    if (savedSQL) {
      setEditorStateInternal(prev => ({ ...prev, sql: savedSQL }))
    }
  }, [])

  // Save SQL to localStorage whenever it changes
  const setEditorState = (state: EditorState) => {
    setEditorStateInternal(state)
    localStorage.setItem('localdb-sql-editor-content', state.sql)
  }

  const updateSQL = (sql: string) => {
    setEditorStateInternal(prev => ({ ...prev, sql }))
    localStorage.setItem('localdb-sql-editor-content', sql)
  }

  const updateActiveTab = (tab: 'result' | 'errors' | 'info') => {
    setEditorStateInternal(prev => ({ ...prev, activeTab: tab }))
  }

  const addFavorite = (name: string, sql: string) => {
    const savedFavorites = localStorage.getItem('localdb-favorites')
    let favorites = []

    if (savedFavorites) {
      try {
        favorites = JSON.parse(savedFavorites)
      } catch (e) {
        console.error('Failed to parse favorites', e)
      }
    }

    const newFavorite = {
      id: `fav-${Date.now()}`,
      label: name,
      type: 'file',
      sql: sql
    }

    favorites.push(newFavorite)
    localStorage.setItem('localdb-favorites', JSON.stringify(favorites))

    // Trigger storage event for InnerSidebar to reload
    window.dispatchEvent(new Event('storage'))
  }

  return (
    <AppContext.Provider
      value={{
        editorState,
        setEditorState,
        updateSQL,
        updateActiveTab,
        addFavorite,
        projectInfo,
        setProjectInfo
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
