import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { 
  ensureLocalDbDirs, 
  getProjectPath, 
  getProjectDbPath, 
  getProjectMetaPath,
  projectExists 
} from '../utils/paths.js';
import { initUserDb, initMetaDb } from '../utils/db-init.js';

export async function newCommand(name) {
  ensureLocalDbDirs();
  
  if (projectExists(name)) {
    console.log(chalk.red(`✗ Project "${name}" already exists`));
    process.exit(1);
  }
  
  const spinner = ora(`Creating project "${name}"...`).start();
  
  try {
    const projectPath = getProjectPath(name);
    const studioPath = join(projectPath, '.studio');
    const migrationsPath = join(projectPath, 'migrations');
    const snapshotsPath = join(projectPath, 'snapshots');
    const studioSnapshotsPath = join(studioPath, 'snapshots');
    
    // Create directories
    mkdirSync(projectPath, { recursive: true });
    mkdirSync(studioPath, { recursive: true });
    mkdirSync(migrationsPath, { recursive: true });
    mkdirSync(snapshotsPath, { recursive: true });
    mkdirSync(studioSnapshotsPath, { recursive: true }); // For automatic branch snapshots
    
    // Initialize databases
    initUserDb(getProjectDbPath(name));
    initMetaDb(getProjectMetaPath(name));
    
    // Create config
    const config = {
      name,
      created_at: new Date().toISOString(),
      version: '1.0.0'
    };
    writeFileSync(
      join(projectPath, 'config.json'),
      JSON.stringify(config, null, 2)
    );
    
    spinner.succeed(chalk.green(`✓ Project "${name}" created successfully`));
    console.log(chalk.dim(`   Location: ${projectPath}`));
    console.log(chalk.dim(`\n   Run: ${chalk.cyan(`localdb start ${name}`)}`));
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to create project'));
    console.error(error);
    process.exit(1);
  }
}