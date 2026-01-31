import { readdirSync, existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import { RUNTIME_DIR, getProjectServerInfoPath } from '../utils/paths.js';

export async function listCommand() {
  if (!existsSync(RUNTIME_DIR)) {
    console.log(chalk.dim('No projects yet'));
    return;
  }
  
  const projects = readdirSync(RUNTIME_DIR);
  
  if (projects.length === 0) {
    console.log(chalk.dim('No projects yet'));
    return;
  }
  
  console.log(chalk.bold('\nProjects:\n'));
  
  projects.forEach(name => {
    const serverInfoPath = getProjectServerInfoPath(name);
    const isRunning = existsSync(serverInfoPath);
    
    if (isRunning) {
      const serverInfo = JSON.parse(readFileSync(serverInfoPath, 'utf-8'));
      console.log(`  ${chalk.green('●')} ${chalk.bold(name)} ${chalk.dim(`(port ${serverInfo.port})`)}`);
    } else {
      console.log(`  ${chalk.gray('○')} ${name}`);
    }
  });
  
  console.log();
}