import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import open from 'open';
import { getProjectServerInfoPath, projectExists } from '../utils/paths.js';

export async function openCommand(name) {
  if (!projectExists(name)) {
    console.log(chalk.red(`✗ Project "${name}" does not exist`));
    process.exit(1);
  }
  
  const serverInfoPath = getProjectServerInfoPath(name);
  
  if (!existsSync(serverInfoPath)) {
    console.log(chalk.yellow(`⚠ Project "${name}" is not running`));
    console.log(chalk.dim(`   Run: ${chalk.cyan(`sql-kite start ${name}`)}`));
    return;
  }
  
  const serverInfo = JSON.parse(readFileSync(serverInfoPath, 'utf-8'));
  console.log(chalk.cyan(`Opening http://localhost:${serverInfo.port}...`));
  await open(`http://localhost:${serverInfo.port}`);
}