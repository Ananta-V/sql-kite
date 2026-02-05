import { existsSync, readFileSync, unlinkSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { getProjectServerInfoPath, projectExists } from '../utils/paths.js';
import { releasePort } from '../utils/port-finder.js';

export async function stopCommand(name) {
  if (!projectExists(name)) {
    console.log(chalk.red(`✗ Project "${name}" does not exist`));
    process.exit(1);
  }
  
  const serverInfoPath = getProjectServerInfoPath(name);
  
  if (!existsSync(serverInfoPath)) {
    console.log(chalk.yellow(`⚠ Project "${name}" is not running`));
    return;
  }
  
  const spinner = ora(`Stopping project "${name}"...`).start();

  try {
    const serverInfo = JSON.parse(readFileSync(serverInfoPath, 'utf-8'));

    // Send SIGTERM signal
    try {
      process.kill(serverInfo.pid, 'SIGTERM');
    } catch (killError) {
      // Process might already be dead, that's okay
      if (killError.code !== 'ESRCH') {
        throw killError;
      }
    }

    // Wait for process to terminate (up to 5 seconds)
    let processTerminated = false;
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        // process.kill with signal 0 checks if process exists without killing it
        process.kill(serverInfo.pid, 0);
      } catch (e) {
        // Process no longer exists
        processTerminated = true;
        break;
      }
    }

    if (!processTerminated) {
      // Force kill if graceful shutdown timed out
      try {
        process.kill(serverInfo.pid, 'SIGKILL');
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        // Process might already be gone
      }
    }

    // Remove server info file
    unlinkSync(serverInfoPath);

    // Release port from registry
    releasePort(name);

    spinner.succeed(chalk.green(`✓ Project "${name}" stopped`));
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to stop project'));
    console.error(error);
    process.exit(1);
  }
}