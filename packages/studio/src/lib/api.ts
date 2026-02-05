const API_BASE = '/api'

export async function getProjectInfo() {
  const res = await fetch(`${API_BASE}/project`)
  if (!res.ok) throw new Error('Failed to fetch project info')
  return res.json()
}

export async function getTables() {
  const res = await fetch(`${API_BASE}/tables`)
  if (!res.ok) throw new Error('Failed to fetch tables')
  return res.json()
}

export async function getTableInfo(tableName: string) {
  const res = await fetch(`${API_BASE}/tables/${tableName}`)
  if (!res.ok) throw new Error('Failed to fetch table info')
  return res.json()
}

export async function getTableData(tableName: string, limit = 100, offset = 0) {
  const res = await fetch(`${API_BASE}/tables/${tableName}/data?limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new Error('Failed to fetch table data')
  return res.json()
}

export async function executeQuery(sql: string) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Query failed')
  return data
}

export async function getTimeline(limit = 50, offset = 0, allBranches = false) {
  const url = `${API_BASE}/timeline?limit=${limit}&offset=${offset}${allBranches ? '&all_branches=true' : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch timeline')
  return res.json()
}

export async function getSnapshots() {
  const res = await fetch(`${API_BASE}/snapshots`)
  if (!res.ok) throw new Error('Failed to fetch snapshots')
  return res.json()
}

export async function createSnapshot(name?: string) {
  const res = await fetch(`${API_BASE}/snapshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  if (!res.ok) throw new Error('Failed to create snapshot')
  return res.json()
}

export async function restoreSnapshot(id: number) {
  const res = await fetch(`${API_BASE}/snapshots/restore/${id}`, {
    method: 'POST'
  })
  if (!res.ok) throw new Error('Failed to restore snapshot')
  return res.json()
}

export async function getMigrations() {
  const res = await fetch(`${API_BASE}/migrations`)
  if (!res.ok) throw new Error('Failed to fetch migrations')
  return res.json()
}

export async function applyMigration(filename: string) {
  const res = await fetch(`${API_BASE}/migrations/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  })
  if (!res.ok) throw new Error('Failed to apply migration')
  return res.json()
}

export async function getSchema() {
  const res = await fetch(`${API_BASE}/schema`)
  if (!res.ok) throw new Error('Failed to fetch schema')
  return res.json()
}

export async function createTable(sql: string) {
  const res = await fetch(`${API_BASE}/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  })
  if (!res.ok) throw new Error('Failed to create table')
  return res.json()
}

export async function dropTable(tableName: string) {
  const res = await fetch(`${API_BASE}/tables/${tableName}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to drop table')
  return res.json()
}

// Branch APIs
export async function getBranches() {
  const res = await fetch(`${API_BASE}/branches`)
  if (!res.ok) throw new Error('Failed to fetch branches')
  return res.json()
}

export async function getCurrentBranch() {
  const res = await fetch(`${API_BASE}/branches/current`)
  if (!res.ok) throw new Error('Failed to fetch current branch')
  return res.json()
}

export async function createBranch(name: string, description?: string, copyFrom?: string) {
  const res = await fetch(`${API_BASE}/branches/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, copyFrom })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create branch')
  return data
}

export async function switchBranch(name: string) {
  const res = await fetch(`${API_BASE}/branches/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to switch branch')
  return data
}

export async function deleteBranch(name: string) {
  const res = await fetch(`${API_BASE}/branches/${name}`, {
    method: 'DELETE'
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to delete branch')
  return data
}

export async function getBranchStats(name: string) {
  const res = await fetch(`${API_BASE}/branches/${name}/stats`)
  if (!res.ok) throw new Error('Failed to fetch branch stats')
  return res.json()
}

// Snapshot APIs (updated for branches)
export async function createSnapshotWithDesc(name: string, description?: string) {
  const res = await fetch(`${API_BASE}/snapshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create snapshot')
  return data
}

// Migration API (create migration)
export async function createMigration(name: string, sql: string) {
  const res = await fetch(`${API_BASE}/migrations/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sql })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create migration')
  return data
}

export async function applyAllMigrations() {
  const res = await fetch(`${API_BASE}/migrations/apply-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to apply migrations')
  return data
}
