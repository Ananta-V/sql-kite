import { join } from 'path';
import { existsSync, copyFileSync, unlinkSync, statSync, readFileSync } from 'fs';
import Database from 'better-sqlite3';
import { getCurrentBranch } from '../db/connections.js';

/**
 * Export Routes
 *
 * Handles exporting production database from main branch
 */

export default async function exportRoutes(fastify, options) {

  /**
   * Get export status and pre-flight checks
   */
  fastify.get('/status', async (request, reply) => {
    const metaDb = fastify.getMetaDb();
    const projectPath = fastify.projectPath;

    try {
      // Check if main branch exists
      const mainBranch = metaDb.prepare(`
        SELECT name, db_file, created_at FROM branches WHERE name = 'main'
      `).get();

      const mainExists = !!mainBranch;
      let databaseHealthy = false;
      let tableCount = 0;
      let totalRows = 0;
      let lastModified = null;
      let pendingMigrations = 0;
      let branchesAheadOfMain = 0;

      if (mainExists) {
        const mainDbPath = join(projectPath, 'branches', mainBranch.db_file);
        
        if (existsSync(mainDbPath)) {
          try {
            // Open main database to check health
            const mainDb = new Database(mainDbPath, { readonly: true });
            
            // Check integrity - PRAGMA returns object with dynamic key
            const integrityResult = mainDb.prepare('PRAGMA integrity_check').get();
            // The result could be { integrity_check: 'ok' } or just check the first value
            const integrityValue = Object.values(integrityResult || {})[0];
            databaseHealthy = integrityValue === 'ok';

            // Get table count
            const tables = mainDb.prepare(`
              SELECT name FROM sqlite_master 
              WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            `).all();
            tableCount = tables.length;

            // Get total row count across tables
            for (const table of tables) {
              try {
                const count = mainDb.prepare(`SELECT COUNT(*) as cnt FROM "${table.name}"`).get();
                totalRows += count?.cnt || 0;
              } catch (e) {
                // Skip tables that can't be counted
              }
            }

            mainDb.close();

            // Get file modification time
            const stat = statSync(mainDbPath);
            lastModified = stat.mtime.toISOString();
          } catch (error) {
            console.error('Error checking main database health:', error);
            databaseHealthy = false;
          }
        }

        // Check for pending migrations
        try {
          const pendingMigrationCount = metaDb.prepare(`
            SELECT COUNT(*) as cnt FROM migrations 
            WHERE status = 'pending' AND branch = 'main'
          `).get();
          pendingMigrations = pendingMigrationCount?.cnt || 0;
        } catch (e) {
          // Migrations table might not exist
          pendingMigrations = 0;
        }

        // Count branches that have changes not in main
        try {
          const branchCount = metaDb.prepare(`
            SELECT COUNT(*) as cnt FROM branches WHERE name != 'main'
          `).get();
          branchesAheadOfMain = branchCount?.cnt || 0;
        } catch (e) {
          branchesAheadOfMain = 0;
        }
      }

      return {
        mainExists,
        databaseHealthy,
        tableCount,
        totalRows,
        lastModified,
        pendingMigrations,
        branchesAheadOfMain
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Export the main branch database
   * 
   * This creates a clean SQLite file:
   * - WAL checkpoint performed
   * - No WAL or SHM files
   * - No branch metadata
   * - No timeline
   * - Just pure SQLite data
   */
  fastify.post('/database', async (request, reply) => {
    const { fileName = 'production' } = request.body || {};
    const metaDb = fastify.getMetaDb();
    const projectPath = fastify.projectPath;

    try {
      // Get main branch info
      const mainBranch = metaDb.prepare(`
        SELECT name, db_file FROM branches WHERE name = 'main'
      `).get();

      if (!mainBranch) {
        return reply.code(400).send({ 
          error: 'Main branch does not exist. Cannot export.' 
        });
      }

      const mainDbPath = join(projectPath, 'branches', mainBranch.db_file);

      if (!existsSync(mainDbPath)) {
        return reply.code(400).send({ 
          error: 'Main database file not found.' 
        });
      }

      // Create a temporary export path
      const exportPath = join(projectPath, '.studio', `export_${Date.now()}.db`);

      try {
        // Open the main database
        const sourceDb = new Database(mainDbPath);

        // Perform WAL checkpoint to ensure all data is in main file
        sourceDb.pragma('wal_checkpoint(TRUNCATE)');

        // Use backup API for clean copy
        await sourceDb.backup(exportPath);

        sourceDb.close();

        // Open the exported database and clean it up
        const exportDb = new Database(exportPath);

        // Vacuum to optimize
        exportDb.exec('VACUUM');

        // Ensure no WAL mode on export (use DELETE journal for compatibility)
        exportDb.pragma('journal_mode = DELETE');

        exportDb.close();

        // Read the file and send as download
        const fileBuffer = readFileSync(exportPath);

        // Clean up temp file
        try {
          unlinkSync(exportPath);
        } catch (e) {
          console.error('Failed to clean up temp export file:', e);
        }

        // Send as binary download
        reply
          .header('Content-Type', 'application/x-sqlite3')
          .header('Content-Disposition', `attachment; filename="${fileName}.db"`)
          .header('Content-Length', fileBuffer.length)
          .send(fileBuffer);

      } catch (error) {
        // Clean up temp file on error
        try {
          if (existsSync(exportPath)) {
            unlinkSync(exportPath);
          }
        } catch (e) {}
        
        throw error;
      }

    } catch (error) {
      console.error('Export error:', error);
      reply.code(500).send({ error: error.message });
    }
  });
}
