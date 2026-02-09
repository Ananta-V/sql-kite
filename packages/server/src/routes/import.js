import { existsSync, mkdirSync, copyFileSync, readFileSync, unlinkSync } from 'fs'
import { join, basename } from 'path'
import Database from 'better-sqlite3'

export default async function importRoutes(fastify, options) {
  const homeDir = process.env.HOME || process.env.USERPROFILE
  const projectsRoot = join(homeDir, '.localdb', 'projects')
  const sessionFile = join(homeDir, '.localdb', 'import-pending.json')

  // Get pending import session
  fastify.get('/pending', async (request, reply) => {
    try {
      if (!existsSync(sessionFile)) {
        return { pending: false }
      }

      const session = JSON.parse(readFileSync(sessionFile, 'utf-8'))
      return { pending: true, ...session }
    } catch (error) {
      fastify.log.error(error)
      return { pending: false, error: error.message }
    }
  })

  // Clear pending import session
  fastify.delete('/pending', async (request, reply) => {
    try {
      if (existsSync(sessionFile)) {
        unlinkSync(sessionFile)
      }
      return { success: true }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }
  })

  // Create project structure
  fastify.post('/create', async (request, reply) => {
    const { projectName, sourcePath, importMode } = request.body

    try {
      const projectPath = join(projectsRoot, projectName)

      // Check if project already exists
      if (existsSync(projectPath)) {
        return reply.code(400).send({ error: 'Project already exists' })
      }

      // Create project directories
      mkdirSync(projectPath, { recursive: true })
      mkdirSync(join(projectPath, 'db', 'branches'), { recursive: true })
      mkdirSync(join(projectPath, 'db', 'snapshots'), { recursive: true })
      mkdirSync(join(projectPath, 'migrations'), { recursive: true })
      mkdirSync(join(projectPath, '.studio'), { recursive: true })
      mkdirSync(join(projectPath, '.studio', 'snapshots'), { recursive: true })
      mkdirSync(join(projectPath, '.studio', 'locks'), { recursive: true })

      // Create meta.db
      const metaDbPath = join(projectPath, '.studio', 'meta.db')
      const metaDb = new Database(metaDbPath)

      // Initialize meta.db tables
      metaDb.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS branches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_from TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          checksum TEXT,
          branch TEXT NOT NULL DEFAULT 'main',
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          branch TEXT NOT NULL DEFAULT 'main',
          description TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id TEXT NOT NULL UNIQUE,
          branch TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)

      // Insert project record
      metaDb.prepare('INSERT INTO projects (name) VALUES (?)').run(projectName)

      // Insert main branch
      metaDb.prepare(`
        INSERT INTO branches (name, description, created_from) 
        VALUES ('main', 'Imported database baseline', NULL)
      `).run()

      metaDb.close()

      return { success: true, projectPath }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }
  })

  // Copy database with WAL checkpoint
  fastify.post('/copy', async (request, reply) => {
    const { projectName, sourcePath, importMode } = request.body

    try {
      const projectPath = join(projectsRoot, projectName)
      const targetPath = join(projectPath, 'db', 'branches', 'main.db')

      if (importMode === 'copy') {
        // Step 1: Open source DB and checkpoint WAL
        let sourceDb
        try {
          sourceDb = new Database(sourcePath)
          
          // Force WAL checkpoint to ensure all data is in main DB file
          sourceDb.pragma('wal_checkpoint(FULL)')
          
          sourceDb.close()
        } catch (err) {
          if (sourceDb) sourceDb.close()
          throw new Error(`Failed to checkpoint source database: ${err.message}`)
        }

        // Step 2: Copy database files
        try {
          // Copy main DB file
          copyFileSync(sourcePath, targetPath)

          // Copy WAL file if exists
          const walPath = sourcePath + '-wal'
          if (existsSync(walPath)) {
            copyFileSync(walPath, targetPath + '-wal')
          }

          // Copy SHM file if exists
          const shmPath = sourcePath + '-shm'
          if (existsSync(shmPath)) {
            copyFileSync(shmPath, targetPath + '-shm')
          }
        } catch (err) {
          throw new Error(`Failed to copy database files: ${err.message}`)
        }

        // Step 3: Verify copied database
        let targetDb
        try {
          targetDb = new Database(targetPath)
          
          // Test query to verify integrity
          targetDb.prepare('SELECT COUNT(*) FROM sqlite_master').get()
          
          // Enable WAL mode for the copied database
          targetDb.pragma('journal_mode = WAL')
          
          targetDb.close()
        } catch (err) {
          if (targetDb) targetDb.close()
          throw new Error(`Failed to verify copied database: ${err.message}`)
        }

      } else if (importMode === 'link') {
        // TODO: Implement symlink mode (advanced)
        return reply.code(400).send({ error: 'Link mode not yet implemented' })
      }

      // Log event in meta.db
      const metaDbPath = join(projectPath, '.studio', 'meta.db')
      const metaDb = new Database(metaDbPath)
      
      metaDb.prepare(`
        INSERT INTO events (type, branch, description, metadata)
        VALUES ('database_imported', 'main', 'Database imported from external source', ?)
      `).run(JSON.stringify({ sourcePath, importMode }))

      metaDb.close()

      return { success: true }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }
  })

  // Create baseline snapshot
  fastify.post('/snapshot', async (request, reply) => {
    const { projectName } = request.body

    try {
      const projectPath = join(projectsRoot, projectName)
      const sourceDbPath = join(projectPath, 'db', 'branches', 'main.db')
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const snapshotId = `imported-baseline-${timestamp}`
      const snapshotPath = join(projectPath, '.studio', 'snapshots', `${snapshotId}.snapshot.db`)

      // Copy database to snapshot
      let sourceDb
      try {
        sourceDb = new Database(sourceDbPath)
        sourceDb.pragma('wal_checkpoint(FULL)')
        sourceDb.close()
      } catch (err) {
        if (sourceDb) sourceDb.close()
        throw err
      }

      copyFileSync(sourceDbPath, snapshotPath)

      // Record snapshot in meta.db
      const metaDbPath = join(projectPath, '.studio', 'meta.db')
      const metaDb = new Database(metaDbPath)

      metaDb.prepare(`
        INSERT INTO snapshots (snapshot_id, branch, description)
        VALUES (?, 'main', 'Baseline snapshot created during import')
      `).run(snapshotId)

      metaDb.prepare(`
        INSERT INTO events (type, branch, description, metadata)
        VALUES ('snapshot_created', 'main', 'Baseline snapshot created', ?)
      `).run(JSON.stringify({ snapshot_id: snapshotId }))

      metaDb.close()

      return { success: true, snapshotId }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }
  })

  // Finalize import
  fastify.post('/finalize', async (request, reply) => {
    const { projectName } = request.body

    try {
      const projectPath = join(projectsRoot, projectName)
      const metaDbPath = join(projectPath, '.studio', 'meta.db')
      const metaDb = new Database(metaDbPath)

      // Create baseline migration marker (NOT a SQL file)
      metaDb.prepare(`
        INSERT INTO migrations (filename, checksum, branch, applied_at)
        VALUES ('baseline', 'imported', 'main', datetime('now'))
      `).run()

      // Log finalization event
      metaDb.prepare(`
        INSERT INTO events (type, branch, description)
        VALUES ('import_completed', 'main', 'Database import completed successfully')
      `).run()

      metaDb.close()

      return { success: true }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }
  })
}
