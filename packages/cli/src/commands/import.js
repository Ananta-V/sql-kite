#!/usr/bin/env node

import { existsSync, statSync, accessSync, constants, writeFileSync, mkdirSync } from 'fs'
import { resolve, extname, basename, join } from 'path'
import Database from 'better-sqlite3'
import chalk from 'chalk'
import { spawn } from 'child_process'
import http from 'http'
import open from 'open'
import { findFreePort } from '../utils/port-finder.js'
import { ensureSqlKiteDirs, LOGS_DIR, SQL_KITE_HOME, getStudioOutPath, getServerEntryPath } from '../utils/paths.js'

export default async function importCommand(dbPath) {
  ensureSqlKiteDirs()
  if (!dbPath) {
    console.error(chalk.red('✗ Error: Database path is required'))
    console.log(chalk.dim('Usage: npm run sql-kite import <path-to-database>'))
    console.log(chalk.dim('   Or: npm run sql-kite open <path-to-database>'))
    process.exit(1)
  }

  const absolutePath = resolve(dbPath)

  // ========================================
  // Step 1: Preflight checks
  // ========================================
  
  console.log(chalk.cyan('→ Running preflight checks...'))

  // Check file exists
  if (!existsSync(absolutePath)) {
    console.error(chalk.red('✗ Error: File does not exist'))
    console.error(chalk.dim(`  Path: ${absolutePath}`))
    process.exit(1)
  }

  // Check it's a file, not directory
  const stats = statSync(absolutePath)
  if (stats.isDirectory()) {
    console.error(chalk.red('✗ Error: Path is a directory, not a database file'))
    console.error(chalk.dim('  Please provide a path to a .db file'))
    process.exit(1)
  }

  // Check for symlinks (security)
  if (stats.isSymbolicLink()) {
    console.error(chalk.red('✗ Error: Symlinks are not supported for security reasons'))
    console.error(chalk.dim('  Please provide a direct path to the database file'))
    process.exit(1)
  }

  // Check file is readable
  try {
    accessSync(absolutePath, constants.R_OK)
  } catch (err) {
    console.error(chalk.red('✗ Error: File is not readable'))
    console.error(chalk.dim(`  Permission denied: ${absolutePath}`))
    process.exit(1)
  }

  // Warn about file extension (don't block)
  const ext = extname(absolutePath).toLowerCase()
  if (ext !== '.db' && ext !== '.sqlite' && ext !== '.sqlite3') {
    console.log(chalk.yellow('⚠ Warning: File extension is not .db, .sqlite, or .sqlite3'))
    console.log(chalk.dim(`  Found: ${ext || '(no extension)'}`))
    console.log(chalk.dim('  Continuing anyway...'))
  }

  console.log(chalk.green('✓ Preflight checks passed'))

  // ========================================
  // Step 2: Read-only probe
  // ========================================

  console.log(chalk.cyan('→ Validating SQLite database...'))

  let db
  try {
    // Open in read-only mode (no WAL writes, no side effects)
    db = new Database(absolutePath, { readonly: true, fileMustExist: true })

    // Test basic query
    try {
      db.prepare('SELECT name FROM sqlite_master LIMIT 1').all()
    } catch (err) {
      console.error(chalk.red('✗ Error: File is not a valid SQLite database'))
      console.error(chalk.dim(`  ${err.message}`))
      db.close()
      process.exit(1)
    }

    // Get metadata
    const userVersion = db.prepare('PRAGMA user_version').get().user_version
    const journalMode = db.prepare('PRAGMA journal_mode').get().journal_mode

    console.log(chalk.green('✓ Valid SQLite database detected'))
    console.log(chalk.dim(`  User version: ${userVersion}`))
    console.log(chalk.dim(`  Journal mode: ${journalMode}`))

    // Get table count
    const tableCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).get().count

    console.log(chalk.dim(`  Tables: ${tableCount}`))

    db.close()
  } catch (err) {
    if (db) db.close()
    console.error(chalk.red('✗ Error: Failed to open database'))
    console.error(chalk.dim(`  ${err.message}`))
    process.exit(1)
  }

  // ========================================
  // Step 3: Generate project name suggestion
  // ========================================

  const suggestedName = basename(absolutePath, extname(absolutePath))
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // ========================================
  // Step 4: Import through Studio
  // ========================================

  console.log('')
  console.log(chalk.green('✓ Database validated successfully'))
  console.log('')

  // Store import session data
  const sqlKiteDir = SQL_KITE_HOME
  const sessionFile = join(sqlKiteDir, 'import-pending.json')

  // Ensure .sql-kite directory exists
  if (!existsSync(sqlKiteDir)) {
    mkdirSync(sqlKiteDir, { recursive: true })
  }

  const importSession = {
    sourcePath: absolutePath,
    suggestedName,
    validated: true,
    timestamp: Date.now()
  }

  writeFileSync(sessionFile, JSON.stringify(importSession, null, 2))

  const defaultPort = 3000
  const importUrl = (port) => `http://localhost:${port}`

  async function getImportServerPort() {
    try {
      const mode = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${defaultPort}/api/project`, (res) => {
          let raw = ''
          res.on('data', (chunk) => { raw += chunk })
          res.on('end', () => {
            try {
              const data = JSON.parse(raw)
              resolve(data.mode || 'project')
            } catch (e) {
              resolve('project')
            }
          })
        })
        req.on('error', reject)
        req.setTimeout(500, () => {
          req.destroy()
          reject(new Error('Timeout'))
        })
      })

      if (mode === 'import') {
        return { port: defaultPort, alreadyRunning: true }
      }
    } catch (e) {
      // Not running on default port
    }

    const port = await findFreePort(defaultPort)
    return { port, alreadyRunning: false }
  }

  async function waitForImportServer(port, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${port}/api/project`, (res) => {
            if (res.statusCode === 200) {
              resolve()
            } else {
              reject(new Error(`Server returned ${res.statusCode}`))
            }
          })
          req.on('error', reject)
          req.setTimeout(1000, () => {
            req.destroy()
            reject(new Error('Timeout'))
          })
        })
        return true
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    return false
  }

  console.log(chalk.bold('Import session ready!'))
  console.log('')
  console.log(chalk.cyan('→ Next steps:'))
  console.log(chalk.dim(`  1. Launching import Studio...`))
  console.log(chalk.dim(`  2. Complete the import wizard`))
  console.log('')
  console.log(chalk.dim(`Session saved to: ${sessionFile}`))

  const studioPath = getStudioOutPath()
  if (!existsSync(studioPath)) {
    console.log(chalk.red(`\n✗ Studio UI not built yet`))
    console.log(chalk.dim(`   Run: ${chalk.cyan(`cd packages/studio && npm run build`)}`))
    return
  }

  try {
    const { port, alreadyRunning } = await getImportServerPort()

    if (!alreadyRunning) {
      const serverPath = getServerEntryPath()
      const logPath = join(LOGS_DIR, `import-server-${Date.now()}.log`)
      const out = []
      const serverProcess = spawn('node', [serverPath], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PORT: port.toString(),
          IMPORT_MODE: 'true'
        }
      })

      serverProcess.stdout.on('data', (chunk) => {
        out.push(chunk.toString())
      })

      serverProcess.stderr.on('data', (chunk) => {
        out.push(chunk.toString())
      })

      serverProcess.unref()

      const ready = await waitForImportServer(port)
      if (!ready) {
        if (out.length > 0) {
          writeFileSync(logPath, out.join(''))
          console.log(chalk.red('✗ Import server failed to start in time'))
          console.log(chalk.dim(`   Log: ${logPath}`))
        } else {
          console.log(chalk.red('✗ Import server failed to start in time'))
          console.log(chalk.dim('   No logs captured. The server may not have started.'))
        }
        return
      }
    }

    console.log(chalk.cyan(`Opening ${importUrl(port)}...`))
    await open(importUrl(port))
  } catch (error) {
    console.log(chalk.red('✗ Failed to launch import Studio'))
    console.log(chalk.dim(error.message))
  }
}
