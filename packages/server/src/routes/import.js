import { existsSync, mkdirSync, copyFileSync, readFileSync, unlinkSync, writeFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { spawn } from 'child_process'
import { fileURLToPath, pathToFileURL } from 'url'
import { homedir } from 'os'
import Database from 'better-sqlite3'

const __routes_dirname = dirname(fileURLToPath(import.meta.url))

// Resolve CLI utils - works in both layouts:
//   monorepo: packages/server/src/routes/ -> ../../../cli/src/utils/
//   npm:      sql-kite/server/routes/     -> ../../src/utils/
const cliUtilsCandidates = [
  join(__routes_dirname, '..', '..', 'src', 'utils'),                // npm layout
  join(__routes_dirname, '..', '..', '..', 'cli', 'src', 'utils')   // monorepo layout
]
let cliUtilsDir
for (const candidate of cliUtilsCandidates) {
  if (existsSync(join(candidate, 'paths.js'))) {
    cliUtilsDir = candidate
    break
  }
}
if (!cliUtilsDir) {
  throw new Error('Could not find CLI utils directory. Tried: ' + cliUtilsCandidates.join(', '))
}
const { findFreePort } = await import(pathToFileURL(join(cliUtilsDir, 'port-finder.js')).href)
const { migrateMetaDb } = await import(pathToFileURL(join(cliUtilsDir, 'meta-migration.js')).href)
const { validateProjectName } = await import(pathToFileURL(join(cliUtilsDir, 'paths.js')).href)

export default async function importRoutes(fastify, options) {
  const homeDir = homedir()
  const projectsRoot = join(homeDir, '.sql-kite', 'runtime')
  const sessionFile = join(homeDir, '.sql-kite', 'import-pending.json')

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

    // Validate project name to prevent path traversal
    const validation = validateProjectName(projectName)
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.error })
    }

    const safeName = validation.sanitized

    try {
      const projectPath = join(projectsRoot, safeName)

      // Check if project already exists
      if (existsSync(projectPath)) {
        return reply.code(400).send({ error: 'Project already exists' })
      }

      // Create project directories
      mkdirSync(projectPath, { recursive: true })
      mkdirSync(join(projectPath, 'migrations'), { recursive: true })
      mkdirSync(join(projectPath, 'snapshots'), { recursive: true })
      mkdirSync(join(projectPath, '.studio'), { recursive: true })
      mkdirSync(join(projectPath, '.studio', 'snapshots'), { recursive: true })
      mkdirSync(join(projectPath, '.studio', 'locks'), { recursive: true })

      // Create config.json
      const config = {
        name: safeName,
        created_at: new Date().toISOString(),
        version: '1.0.0'
      }
      writeFileSync(
        join(projectPath, 'config.json'),
        JSON.stringify(config, null, 2)
      )

      // Initialize meta.db using the shared migration
      const metaDbPath = join(projectPath, '.studio', 'meta.db')
      migrateMetaDb(metaDbPath)

      // Update main branch description and ensure current branch
      const metaDb = new Database(metaDbPath)
      metaDb.prepare(`
        UPDATE branches
        SET description = 'Imported database baseline'
        WHERE name = 'main'
      `).run()
      metaDb.prepare(`
        INSERT OR REPLACE INTO settings (key, value)
        VALUES ('current_branch', 'main')
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

    // Validate project name
    const validation = validateProjectName(projectName)
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.error })
    }

    try {
      const projectPath = join(projectsRoot, validation.sanitized)
      const targetPath = join(projectPath, 'db.sqlite')

      if (importMode === 'copy') {
        // Step 1: Open source DB and checkpoint WAL
        let sourceDb
        try {
          sourceDb = new Database(sourcePath, { fileMustExist: true })
          
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
        if (!existsSync(sourcePath)) {
          return reply.code(400).send({ error: 'Source database not found' })
        }
      }

      // Update main branch db_file
      const metaDbPath = join(projectPath, '.studio', 'meta.db')
      const metaDb = new Database(metaDbPath)

      const dbFile = importMode === 'link' ? sourcePath : 'db.sqlite'
      metaDb.prepare(`
        UPDATE branches
        SET db_file = ?
        WHERE name = 'main'
      `).run(dbFile)
      
      // Log event in meta.db
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES ('main', 'database_imported', ?)
      `).run(JSON.stringify({ sourcePath, importMode, db_file: dbFile }))

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

    // Validate project name
    const validation = validateProjectName(projectName)
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.error })
    }

    try {
      const projectPath = join(projectsRoot, validation.sanitized)
      const metaDbPath = join(projectPath, '.studio', 'meta.db')
      const metaDb = new Database(metaDbPath)
      const branchInfo = metaDb.prepare(`
        SELECT db_file FROM branches WHERE name = 'main'
      `).get()

      if (!branchInfo) {
        metaDb.close()
        return reply.code(404).send({ error: 'Main branch not found' })
      }

      const sourceDbPath = join(projectPath, branchInfo.db_file)
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const snapshotFilename = `imported-baseline-${timestamp}.db`
      const snapshotDir = join(projectPath, '.studio', 'snapshots')
      
      // Ensure snapshots directory exists
      if (!existsSync(snapshotDir)) {
        mkdirSync(snapshotDir, { recursive: true })
      }
      
      const snapshotPath = join(snapshotDir, snapshotFilename)

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
      const stats = statSync(snapshotPath)

      metaDb.prepare(`
        INSERT INTO snapshots (branch, filename, name, size, description)
        VALUES ('main', ?, 'Imported Baseline', ?, 'Baseline snapshot created during import')
      `).run(snapshotFilename, stats.size)

      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES ('main', 'snapshot_created', ?)
      `).run(JSON.stringify({ filename: snapshotFilename }))

      metaDb.close()

      return { success: true, snapshotId: snapshotFilename }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }
  })

  // Finalize import
  fastify.post('/finalize', async (request, reply) => {
    const { projectName } = request.body

    // Validate project name
    const validation = validateProjectName(projectName)
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.error })
    }
    const safeName = validation.sanitized

    try {
      const projectPath = join(projectsRoot, safeName)
      const metaDbPath = join(projectPath, '.studio', 'meta.db')
      const metaDb = new Database(metaDbPath)

      // Create baseline migration marker (NOT a SQL file)
      metaDb.prepare(`
        INSERT INTO migrations (branch, filename, applied_at)
        VALUES ('main', 'baseline', datetime('now'))
      `).run()

      // Log finalization event
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES ('main', 'import_completed', ?)
      `).run(JSON.stringify({ completed_at: new Date().toISOString() }))

      metaDb.close()

      // Create lock file for main branch
      const locksDir = join(projectPath, '.studio', 'locks')
      if (!existsSync(locksDir)) {
        mkdirSync(locksDir, { recursive: true })
      }
      const lockPath = join(locksDir, 'main.lock')
      if (!existsSync(lockPath)) {
        writeFileSync(
          lockPath,
          JSON.stringify({
            branch: 'main',
            created_at: new Date().toISOString(),
            reason: 'import'
          }, null, 2)
        )
      }

      // Start project server automatically
      const serverInfoPath = join(projectPath, '.studio', 'server.json')
      if (existsSync(serverInfoPath)) {
        const serverInfo = JSON.parse(readFileSync(serverInfoPath, 'utf-8'))
        return { success: true, server: { running: true, port: serverInfo.port } }
      }

      const port = await findFreePort(3000, safeName)
      const serverPath = join(__routes_dirname, '..', 'index.js')
      const serverProcess = spawn('node', [serverPath], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          PROJECT_NAME: safeName,
          PROJECT_PATH: projectPath,
          PORT: port.toString(),
          IMPORT_MODE: 'false'
        }
      })
      serverProcess.unref()

      writeFileSync(serverInfoPath, JSON.stringify({
        pid: serverProcess.pid,
        port,
        started_at: new Date().toISOString()
      }, null, 2))

      return { success: true, server: { running: true, port } }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }
  })
}
