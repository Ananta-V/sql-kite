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

type Page = 'home' | 'tables' | 'sql' | 'timeline' | 'snapshots'

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

  return (
    <div className="flex h-screen bg-studio-bg text-studio-text">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar projectInfo={projectInfo} />
        
        <main className="flex-1 overflow-auto">
          {currentPage === 'home' && <HomePage projectInfo={projectInfo} />}
          {currentPage === 'tables' && <TablesPage />}
          {currentPage === 'sql' && <SQLEditorPage />}
          {currentPage === 'timeline' && <TimelinePage />}
          {currentPage === 'snapshots' && <SnapshotsPage />}
        </main>
      </div>
    </div>
  )
}