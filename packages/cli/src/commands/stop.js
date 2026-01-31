import { existsSync, readFileSync, unlinkSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { getProjectServerInfoPath, projectExists } from '../utils/paths.js';

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
    
    // Kill process
    process.kill(serverInfo.pid, 'SIGTERM');
    
    // Remove server info file
    unlinkSync(serverInfoPath);
    
    spinner.succeed(chalk.green(`✓ Project "${name}" stopped`));
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to stop project'));
    console.error(error);
    process.exit(1);
  }
}