#!/usr/bin/env node

import { existsSync, statSync, accessSync, constants, writeFileSync, mkdirSync } from 'fs'
import { resolve, extname, basename, join } from 'path'
import Database from 'better-sqlite3'
import chalk from 'chalk'
import { exec } from 'child_process'

export default function importCommand(dbPath) {
  if (!dbPath) {
    console.error(chalk.red('✗ Error: Database path is required'))
    console.log(chalk.dim('Usage: localdb import <path-to-database>'))
    console.log(chalk.dim('   Or: localdb open <path-to-database>'))
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
  const homeDir = process.env.HOME || process.env.USERPROFILE
  const localdbDir = join(homeDir, '.localdb')
  const sessionFile = join(localdbDir, 'import-pending.json')

  // Ensure .localdb directory exists
  if (!existsSync(localdbDir)) {
    mkdirSync(localdbDir, { recursive: true })
  }

  const importSession = {
    sourcePath: absolutePath,
    suggestedName,
    validated: true,
    timestamp: Date.now()
  }

  writeFileSync(sessionFile, JSON.stringify(importSession, null, 2))

  const importUrl = 'http://localhost:3000'

  console.log(chalk.bold('Import session ready!'))
  console.log('')
  console.log(chalk.cyan('→ Next steps:'))
  console.log(chalk.dim(`  1. Run: `) + chalk.cyan('localdb import-server'))
  console.log(chalk.dim(`  2. Open: `) + chalk.cyan(importUrl))
  console.log(chalk.dim(`  3. Complete the import wizard`))
  console.log('')
  console.log(chalk.dim(`Session saved to: ${sessionFile}`))
}
