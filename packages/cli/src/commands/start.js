import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { 
  getProjectPath, 
  getProjectServerInfoPath,
  projectExists 
} from '../utils/paths.js';
import { findFreePort } from '../utils/port-finder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startCommand(name) {
  if (!projectExists(name)) {
    console.log(chalk.red(`✗ Project "${name}" does not exist`));
    console.log(chalk.dim(`   Run: ${chalk.cyan(`localdb new ${name}`)}`));
    process.exit(1);
  }
  
  // Check if studio is built
  const studioPath = join(__dirname, '../../../studio/out');
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
    const port = await findFreePort(3000);
    const projectPath = getProjectPath(name);
    
    // Path to server package
    const serverPath = join(__dirname, '../../../server/src/index.js');
    
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
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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