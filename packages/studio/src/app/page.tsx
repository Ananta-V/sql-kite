'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import HomePage from '@/components/HomePage'
import TablesPage from '@/components/TablesPage'
import SQLEditorPage from '@/components/SQLEditorPage'
import TimelinePage from '@/components/TimelinePage'
import SnapshotsPage from '@/components/SnapshotsPage'
import { getProjectInfo } from '@/lib/api'

type Page = 'home' | 'sql' | 'database' | 'snapshots' | 'timeline' | 'settings'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [projectInfo, setProjectInfo] = useState<any>(null)

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

  // Determine which features to show in top bar
  const topBarProps = {
    projectInfo,
    showCompare: currentPage === 'sql',
    showBranch: currentPage === 'sql',
    showAI: currentPage === 'sql',
  }

  return (
    <div className="flex h-screen bg-app-bg text-app-text">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar {...topBarProps} />
        
        <main className="flex-1 overflow-hidden">
          {currentPage === 'home' && <HomePage projectInfo={projectInfo} />}
          {currentPage === 'sql' && <SQLEditorPage />}
          {currentPage === 'database' && <TablesPage />}
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
    </div>
  )
}