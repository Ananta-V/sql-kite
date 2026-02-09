import { Command } from 'commander';
import chalk from 'chalk';
import { newCommand } from './commands/new.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { listCommand } from './commands/list.js';
import { deleteCommand } from './commands/delete.js';
import { openCommand } from './commands/open.js';
import { portsCommand } from './commands/ports.js';
import importCommand from './commands/import.js';
import importServerCommand from './commands/import-server.js';

const program = new Command();

program
  .name('localdb')
  .description('Local SQLite database platform with Studio UI')
  .version('1.0.0');

program
  .command('new <name>')
  .description('Create a new database project')
  .action(newCommand);

program
  .command('start <name>')
  .description('Start the database server and open Studio')
  .action(startCommand);

program
  .command('stop <name>')
  .description('Stop the database server')
  .action(stopCommand);

program
  .command('open <name>')
  .description('Open Studio in browser (if server is running)')
  .action(openCommand);

program
  .command('import <database-path>')
  .description('Import an existing SQLite database into a managed project')
  .action(importCommand);

program
  .command('import-server')
  .description('Start import server (for completing pending imports)')
  .option('-p, --port <port>', 'Port to run server on', '3000')
  .action((options) => importServerCommand(parseInt(options.port)));

program
  .command('list')
  .description('List all database projects')
  .action(listCommand);

program
  .command('delete <name>')
  .description('Delete a database project')
  .action(deleteCommand);

program
  .command('ports')
  .description('View and manage port allocations')
  .option('--cleanup', 'Clean up stale port allocations')
  .action(portsCommand);

program.parse();