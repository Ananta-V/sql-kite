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
  const { projectInfo, setProjectInfo } = useAppContext()

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
  }

  function handleCreateBranch() {
    setShowBranchModal(true)
  }

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
        />

        <main className="flex-1 overflow-hidden">
          {currentPage === 'home' && <HomePage projectInfo={projectInfo} />}
          {currentPage === 'sql' && <SQLEditorPage />}
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
              <p className="text-app-text-dim mt-2">Coming soon...</p>
            </div>
          )}
        </main>
      </div>

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