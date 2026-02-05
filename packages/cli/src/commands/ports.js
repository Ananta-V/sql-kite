import chalk from 'chalk';
import { getPortStatus, cleanupStalePorts } from '../utils/port-finder.js';

export async function portsCommand(options = {}) {
  if (options.cleanup) {
    console.log(chalk.cyan('Cleaning up stale port allocations...'));
    const cleaned = cleanupStalePorts();
    console.log(chalk.green(`✓ Cleaned ${cleaned} stale allocation(s)`));
    return;
  }

  const status = getPortStatus();

  console.log(chalk.bold('\n📊 LocalDB Port Registry Status\n'));

  if (status.total_allocations === 0) {
    console.log(chalk.dim('  No ports currently allocated'));
    console.log(chalk.dim('  All projects are stopped\n'));
    return;
  }

  console.log(chalk.cyan(`  Total allocations: ${status.total_allocations}\n`));

  // Sort by port number
  const allocations = Object.entries(status.allocations).sort(
    (a, b) => a[1].port - b[1].port
  );

  console.log(chalk.bold('  Project              Port    Allocated At              PID'));
  console.log(chalk.dim('  ─────────────────────────────────────────────────────────────'));

  for (const [projectName, info] of allocations) {
    const allocatedTime = new Date(info.allocated_at).toLocaleString();
    const projectDisplay = projectName.padEnd(20);
    const portDisplay = info.port.toString().padEnd(7);
    const pidDisplay = info.pid.toString().padEnd(7);

    console.log(`  ${chalk.green(projectDisplay)} ${chalk.cyan(portDisplay)} ${allocatedTime}  ${pidDisplay}`);
  }

  console.log('');

  if (status.last_cleanup) {
    const lastCleanup = new Date(status.last_cleanup).toLocaleString();
    console.log(chalk.dim(`  Last cleanup: ${lastCleanup}`));
  }

  console.log(chalk.dim('\n  Run with --cleanup to remove stale allocations\n'));
}
