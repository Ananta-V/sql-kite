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

export async function getTimeline(limit = 50, offset = 0) {
  const res = await fetch(`${API_BASE}/timeline?limit=${limit}&offset=${offset}`)
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