import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import http from 'http';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import {
  getProjectPath,
  getProjectServerInfoPath,
  projectExists,
  getStudioOutPath,
  getServerEntryPath
} from '../utils/paths.js';
import { findFreePort } from '../utils/port-finder.js';

// Helper function to check if server is ready
async function waitForServer(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/api/project`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Server returned ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch (e) {
      // Server not ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

export async function startCommand(name) {
  if (!projectExists(name)) {
    console.log(chalk.red(`✗ Project "${name}" does not exist`));
    console.log(chalk.dim(`   Run: ${chalk.cyan(`npm run sql-kite new ${name}`)}`));
    process.exit(1);
  }
  
  // Check if studio is built
  const studioPath = getStudioOutPath();
  if (!existsSync(studioPath)) {
    console.log(chalk.red(`✗ Studio UI not built yet`));
    console.log(chalk.dim(`   Run: ${chalk.cyan(`cd packages/studio && npm run build`)}`));
    process.exit(1);
  }
  
  const serverInfoPath = getProjectServerInfoPath(name);
  
  // Check if already running
  if (existsSync(serverInfoPath)) {
    try {
      const serverInfo = JSON.parse(readFileSync(serverInfoPath, 'utf-8'));
      console.log(chalk.yellow(`⚠ Project "${name}" is already running`));
      console.log(chalk.dim(`   URL: ${chalk.cyan(`http://localhost:${serverInfo.port}`)}`));
      await open(`http://localhost:${serverInfo.port}`);
      return;
    } catch (e) {
      // Server info corrupted, continue with start
    }
  }
  
  const spinner = ora(`Starting project "${name}"...`).start();

  try {
    // Find and reserve a port for this project
    const port = await findFreePort(3000, name);
    const projectPath = getProjectPath(name);
    
    // Path to server package
    const serverPath = getServerEntryPath();
    
    // Spawn server process
    const serverProcess = spawn('node', [serverPath], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PROJECT_NAME: name,
        PROJECT_PATH: projectPath,
        PORT: port.toString()
      }
    });
    
    serverProcess.unref();
    
    // Write server info
    const serverInfo = {
      pid: serverProcess.pid,
      port,
      started_at: new Date().toISOString()
    };
    writeFileSync(serverInfoPath, JSON.stringify(serverInfo, null, 2));

    // Wait for server to be ready
    spinner.text = `Waiting for server to start...`;
    const serverReady = await waitForServer(port);

    if (!serverReady) {
      spinner.fail(chalk.red('✗ Server failed to start in time'));
      console.log(chalk.yellow('⚠ Server might still be starting. Check logs for errors.'));
      process.exit(1);
    }

    spinner.succeed(chalk.green(`✓ Project "${name}" started`));
    console.log(chalk.dim(`   URL: ${chalk.cyan(`http://localhost:${port}`)}`));
    console.log(chalk.dim(`   PID: ${serverProcess.pid}`));

    // Open browser
    await open(`http://localhost:${port}`);
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to start project'));
    console.error(error);
    process.exit(1);
  }
}