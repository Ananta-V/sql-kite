import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { 
  ensureSqlKiteDirs, 
  getProjectPath, 
  getProjectDbPath, 
  getProjectMetaPath,
  projectExists,
  validateProjectName 
} from '../utils/paths.js';
import { initUserDb, initMetaDb } from '../utils/db-init.js';

export async function newCommand(name) {
  ensureSqlKiteDirs();
  
  // Validate project name to prevent path traversal
  const validation = validateProjectName(name);
  if (!validation.valid) {
    console.log(chalk.red(`✗ ${validation.error}`));
    process.exit(1);
  }
  
  if (projectExists(validation.sanitized)) {
    console.log(chalk.red(`✗ Project "${validation.sanitized}" already exists`));
    process.exit(1);
  }
  
  const spinner = ora(`Creating project "${validation.sanitized}"...`).start();
  
  try {
    const projectPath = getProjectPath(validation.sanitized);
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
    initUserDb(getProjectDbPath(validation.sanitized));
    initMetaDb(getProjectMetaPath(validation.sanitized));
    
    // Create config
    const config = {
      name: validation.sanitized,
      created_at: new Date().toISOString(),
      version: '1.0.0'
    };
    writeFileSync(
      join(projectPath, 'config.json'),
      JSON.stringify(config, null, 2)
    );
    
    spinner.succeed(chalk.green(`✓ Project "${validation.sanitized}" created successfully`));
    console.log(chalk.dim(`   Location: ${projectPath}`));
    console.log(chalk.dim(`\n   Run: ${chalk.cyan(`npm run sql-kite start ${validation.sanitized}`)}`));
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to create project'));
    console.error(error);
    process.exit(1);
  }
}