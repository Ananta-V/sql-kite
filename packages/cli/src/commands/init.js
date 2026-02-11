import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

const ENGINE_DEV_TEMPLATE = `/**
 * Development Database Engine
 * Connects to SQL-Kite server via HTTP
 * Used during development only
 * 
 * ✅ LOCKED TO MAIN BRANCH
 * The API is hardcoded to ONLY query the 'main' branch.
 * You can switch branches in SQL-Kite Studio without affecting your app.
 * Your app will always query main.
 * 
 * Port Configuration:
 * 1. Set SQL_KITE_PORT environment variable
 * 2. Or update DEFAULT_PORT below
 * 3. Port is shown when you run: sql-kite start <project>
 */

const DEFAULT_PORT = 3000;

// Auto-detect port from environment or use default
const getApiUrl = () => {
  const port = process.env.SQL_KITE_PORT || DEFAULT_PORT;
  return "http://localhost:" + port;
};

export async function runDevQuery(sql, params = []) {
  try {
    const apiUrl = getApiUrl();
    const res = await fetch(apiUrl + "/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });

    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Query failed");
    }

    return data.result;
  } catch (error) {
    console.error("Dev database error:", error);
    console.error("Make sure SQL-Kite is running on port " + (process.env.SQL_KITE_PORT || DEFAULT_PORT));
    throw error;
  }
}
`;

const ENGINE_LOCAL_TEMPLATE = `/**
 * Local Database Engine
 * Connects to local SQLite database using expo-sqlite
 * Used in production builds
 * 
 * IMPORTANT: Install expo-sqlite first:
 * npx expo install expo-sqlite
 */

import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabase("main.db");

export function runLocalQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_, result) => {
          resolve(result.rows._array);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}
`;

const INDEX_TEMPLATE = `/**
 * Unified Database Layer
 * Automatically switches between dev and production engines
 * 
 * Usage in your app:
 * 
 * import { runQuery } from '@/lib/database';
 * 
 * const users = await runQuery(
 *   "SELECT * FROM users WHERE active = ?",
 *   [1]
 * );
 */

import { runDevQuery } from "./engine.dev";
import { runLocalQuery } from "./engine.local";

// In Expo, __DEV__ is available globally
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

export async function runQuery(sql, params = []) {
  try {
    if (isDev) {
      // Development: Use HTTP connection to SQL-Kite
      return await runDevQuery(sql, params);
    } else {
      // Production: Use local SQLite database
      return await runLocalQuery(sql, params);
    }
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
}

// Export individual engines for advanced use cases
export { runDevQuery, runLocalQuery };
`;

export async function initCommand() {
  const spinner = ora('Initializing database layer...').start();

  try {
    // Determine target directory
    const targetDir = join(process.cwd(), 'lib', 'database');
    const relativeDir = 'lib/database';

    // Check if directory already exists
    if (existsSync(targetDir)) {
      spinner.stop();
      
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: chalk.yellow('Directory ' + relativeDir + ' already exists. Overwrite?'),
          default: false
        }
      ]);

      if (!overwrite) {
        console.log(chalk.dim('   Cancelled.'));
        return;
      }

      spinner.start('Creating database layer...');
    }

    // Create directory
    mkdirSync(targetDir, { recursive: true });

    // Write files
    writeFileSync(join(targetDir, 'engine.dev.js'), ENGINE_DEV_TEMPLATE);
    writeFileSync(join(targetDir, 'engine.local.js'), ENGINE_LOCAL_TEMPLATE);
    writeFileSync(join(targetDir, 'index.js'), INDEX_TEMPLATE);

    spinner.succeed('Database layer created successfully!');

    // Print instructions
    console.log('');
    console.log(chalk.bold('📁 Files created:'));
    console.log(chalk.dim('   ' + relativeDir + '/index.js'));
    console.log(chalk.dim('   ' + relativeDir + '/engine.dev.js'));
    console.log(chalk.dim('   ' + relativeDir + '/engine.local.js'));
    console.log('');
    console.log(chalk.bold('🚀 Usage:'));
    console.log(chalk.cyan("   import { runQuery } from '@/lib/database';"));
    console.log(chalk.cyan('   const users = await runQuery("SELECT * FROM users");'));
    console.log('');
    console.log(chalk.bold('📖 Next steps:'));
    console.log(chalk.dim('   1. Start SQL-Kite: ' + chalk.cyan('npm run sql-kite start <project>')));
    console.log(chalk.dim('   2. Note the port (e.g., localhost:3001)'));
    console.log(chalk.dim('   3. Set port: ' + chalk.cyan('SQL_KITE_PORT=3001 in .env')));
    console.log(chalk.dim('   4. Use runQuery() in your app'));
    console.log(chalk.dim('   5. For production: ' + chalk.cyan('npx expo install expo-sqlite')));
    console.log('');
    console.log(chalk.bold('⚙️  Port configuration:'));
    console.log(chalk.dim('   • AUTO: Set SQL_KITE_PORT env variable (recommended)'));
    console.log(chalk.dim('   • MANUAL: Edit DEFAULT_PORT in engine.dev.js'));
    console.log('');

  } catch (error) {
    spinner.fail('Failed to initialize database layer');
    console.error(chalk.red('   Error: ' + error.message));
    process.exit(1);
  }
}
