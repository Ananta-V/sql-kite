#!/usr/bin/env node

import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default function importServerCommand(port = 3000) {
  console.log(chalk.cyan('→ Starting import server...'))
  console.log(chalk.dim(`  Port: ${port}`))
  console.log(chalk.dim('  Mode: Import-only'))
  console.log('')

  const serverPath = join(__dirname, '../../../server/src/index.js')

  const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: port,
      IMPORT_MODE: 'true'
    }
  })

  serverProcess.on('error', (error) => {
    console.error(chalk.red('✗ Failed to start import server:'), error.message)
    process.exit(1)
  })

  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(chalk.red(`✗ Import server exited with code ${code}`))
      process.exit(code)
    }
  })

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n→ Stopping import server...'))
    serverProcess.kill('SIGINT')
    process.exit(0)
  })

  console.log(chalk.green('✓ Import server started'))
  console.log(chalk.dim(`  Open: http://localhost:${port}`))
  console.log('')
  console.log(chalk.dim('Press Ctrl+C to stop'))
}
