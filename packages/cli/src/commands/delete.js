import { rmSync } from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { getProjectPath, projectExists } from '../utils/paths.js';
import { stopCommand } from './stop.js';

export async function deleteCommand(name) {
  if (!projectExists(name)) {
    console.log(chalk.red(`✗ Project "${name}" does not exist`));
    process.exit(1);
  }
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Delete project "${name}"? This cannot be undone.`,
      default: false
    }
  ]);
  
  if (!confirm) {
    console.log(chalk.dim('Cancelled'));
    return;
  }
  
  const spinner = ora(`Deleting project "${name}"...`).start();
  
  try {
    // Stop if running
    await stopCommand(name).catch(() => {});
    
    // Delete project folder
    rmSync(getProjectPath(name), { recursive: true, force: true });
    
    spinner.succeed(chalk.green(`✓ Project "${name}" deleted`));
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to delete project'));
    console.error(error);
    process.exit(1);
  }
}