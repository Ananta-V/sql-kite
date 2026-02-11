'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import HomePage from '@/components/HomePage'
import DatabasePage from '@/components/DatabasePage'
import SQLEditorPage from '@/components/SQLEditorPage'
import TimelinePage from '@/components/TimelinePage'
import SnapshotsPage from '@/components/SnapshotsPage'
import MigrationsPage from '@/components/MigrationsPage'
import BranchesPage from '@/components/BranchesPage'
import BranchCreateModal from '@/components/BranchCreateModal'
import { AppProvider, useAppContext } from '@/contexts/AppContext'
import { getProjectInfo } from '@/lib/api'

type Page = 'home' | 'sql' | 'database' | 'branches' | 'migrations' | 'snapshots' | 'timeline' | 'settings'

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const { projectInfo, setProjectInfo, incrementBranchVersion } = useAppContext()

  useEffect(() => {
    loadProjectInfo()
  }, [])

  async function loadProjectInfo() {
    try {
      const info = await getProjectInfo()
      setProjectInfo(info)
    } catch (error) {
      console.error('Failed to load project info:', error)
    }
  }

  function handleBranchChange() {
    loadProjectInfo()
    incrementBranchVersion()
  }

  function handleCreateBranch() {
    setShowBranchModal(true)
  }

  useEffect(() => {
    if (currentPage !== 'sql' && compareMode) {
      setCompareMode(false)
    }
  }, [currentPage, compareMode])

  // Show AI button only on SQL editor page
  const showAI = currentPage === 'sql'

  return (
    <div className="flex h-screen bg-app-bg text-app-text">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          projectInfo={projectInfo}
          currentBranch={projectInfo?.currentBranch}
          onBranchChange={handleBranchChange}
          onCreateBranchClick={handleCreateBranch}
          showAI={showAI}
          onAIClick={() => setShowAIPanel((open) => !open)}
          disableBranchSelector={currentPage === 'sql' && compareMode}
        />

        <main className="flex-1 overflow-hidden">
          {currentPage === 'home' && <HomePage projectInfo={projectInfo} />}
          {currentPage === 'sql' && (
            <SQLEditorPage
              compareMode={compareMode}
              onCompareModeChange={setCompareMode}
            />
          )}
          {currentPage === 'database' && <DatabasePage />}
          {currentPage === 'branches' && (
            <BranchesPage 
              currentBranch={projectInfo?.currentBranch || 'main'}
              onBranchChange={handleBranchChange}
              onCreateClick={handleCreateBranch}
            />
          )}
          {currentPage === 'migrations' && <MigrationsPage />}
          {currentPage === 'timeline' && <TimelinePage />}
          {currentPage === 'snapshots' && <SnapshotsPage />}
          {currentPage === 'settings' && (
            <div className="p-8">
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-app-text-dim mt-2">settings will be added later to further modify values and workflows.</p>
            </div>
          )}
        </main>
      </div>

      {showAI && showAIPanel && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAIPanel(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-app-sidebar border-l border-app-border shadow-2xl flex flex-col">
            <div className="h-12 px-4 border-b border-app-border flex items-center justify-between">
              <div className="text-sm font-semibold">AI Assistant</div>
              <button
                onClick={() => setShowAIPanel(false)}
                className="px-2 py-1 text-xs bg-app-sidebar-active hover:bg-app-sidebar-hover rounded transition-colors"
              >
                Close
              </button>
            </div>
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <div className="text-2xl font-bold mb-2">Comming soon</div>
              <p className="text-sm text-app-text-dim max-w-sm">
                We are building a focused assistant for SQL, schema insights, and query tuning.
              </p>
              <div className="mt-6 w-full max-w-xs rounded-lg border border-app-border bg-app-bg/60 p-4 text-xs text-app-text-dim">
                Stay tuned for guided query help, ER diagram hints, and migration suggestions.
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Branch Create Modal */}
      <BranchCreateModal
        isOpen={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        currentBranch={projectInfo?.currentBranch || 'main'}
        onSuccess={handleBranchChange}
      />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}