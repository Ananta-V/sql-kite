import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getCurrentBranch, closeBranchConnection, getMetaDb } from '../db/connections.js';

/**
 * Branch Operations
 *
 * Handles creating, switching, and managing branches
 */

export default async function branchesRoutes(fastify, options) {

  /**
   * Get all branches
   */
  fastify.get('/', async (request, reply) => {
    const metaDb = fastify.getMetaDb();
    const currentBranch = getCurrentBranch(fastify.projectPath);

    try {
      const branches = metaDb.prepare(`
        SELECT
          name,
          db_file,
          created_at,
          created_from,
          description
        FROM branches
        ORDER BY
          CASE WHEN name = 'main' THEN 0 ELSE 1 END,
          created_at DESC
      `).all();

      return {
        current: currentBranch,
        branches: branches.map(b => ({
          ...b,
          is_current: b.name === currentBranch
        }))
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Get current branch info
   */
  fastify.get('/current', async (request, reply) => {
    const metaDb = fastify.getMetaDb();
    const currentBranch = getCurrentBranch(fastify.projectPath);

    try {
      const branch = metaDb.prepare(`
        SELECT * FROM branches WHERE name = ?
      `).get(currentBranch);

      if (!branch) {
        return reply.code(404).send({ error: 'Current branch not found' });
      }

      return branch;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Create a new branch
   */
  fastify.post('/create', async (request, reply) => {
    const { name, description, copyFrom } = request.body;
    const metaDb = fastify.getMetaDb();
    const currentBranch = getCurrentBranch(fastify.projectPath);

    // Validate branch name
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return reply.code(400).send({
        error: 'Invalid branch name. Use only letters, numbers, hyphens, and underscores.'
      });
    }

    // Check if branch already exists
    const existingBranch = metaDb.prepare(`
      SELECT name FROM branches WHERE name = ?
    `).get(name);

    if (existingBranch) {
      return reply.code(400).send({ error: 'Branch already exists' });
    }

    try {
      const sourceBranch = copyFrom || currentBranch;

      // Get source branch DB file
      const sourceInfo = metaDb.prepare(`
        SELECT db_file FROM branches WHERE name = ?
      `).get(sourceBranch);

      if (!sourceInfo) {
        return reply.code(404).send({ error: 'Source branch not found' });
      }

      // New DB file name
      const newDbFile = `${name}.db.sqlite`;
      const sourceDbPath = join(fastify.projectPath, sourceInfo.db_file);
      const newDbPath = join(fastify.projectPath, newDbFile);

      // Copy database file
      copyFileSync(sourceDbPath, newDbPath);

      // Also copy WAL and SHM files if they exist
      ['.wal', '.shm'].forEach(ext => {
        const sourceWalPath = sourceDbPath + ext;
        const newWalPath = newDbPath + ext;
        if (existsSync(sourceWalPath)) {
          copyFileSync(sourceWalPath, newWalPath);
        }
      });

      // Create branch record
      metaDb.prepare(`
        INSERT INTO branches (name, db_file, created_from, description)
        VALUES (?, ?, ?, ?)
      `).run(name, newDbFile, sourceBranch, description || '');

      // Log event in CURRENT branch (the one we created from)
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'branch_created', ?)
      `).run(currentBranch, JSON.stringify({
        branch: name,
        from: sourceBranch
      }));

      return {
        success: true,
        branch: {
          name,
          db_file: newDbFile,
          created_from: sourceBranch
        }
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Switch to a different branch
   */
  fastify.post('/switch', async (request, reply) => {
    const { name } = request.body;
    const metaDb = fastify.getMetaDb();
    const currentBranch = getCurrentBranch(fastify.projectPath);

    if (!name) {
      return reply.code(400).send({ error: 'Branch name is required' });
    }

    if (currentBranch === name) {
      return { success: true, message: 'Already on this branch' };
    }

    try {
      // Check if target branch exists
      const targetBranch = metaDb.prepare(`
        SELECT * FROM branches WHERE name = ?
      `).get(name);

      if (!targetBranch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      // Close current branch connection
      closeBranchConnection(fastify.projectPath, currentBranch);

      // Update current branch
      metaDb.prepare(`
        INSERT OR REPLACE INTO settings (key, value)
        VALUES ('current_branch', ?)
      `).run(name);

      // Log switch event in NEW branch
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'branch_switched', ?)
      `).run(name, JSON.stringify({
        from: currentBranch,
        to: name
      }));

      return {
        success: true,
        previous: currentBranch,
        current: name
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Delete a branch
   */
  fastify.delete('/:name', async (request, reply) => {
    const { name } = request.params;
    const metaDb = fastify.getMetaDb();
    const currentBranch = getCurrentBranch(fastify.projectPath);

    // Cannot delete main branch
    if (name === 'main') {
      return reply.code(400).send({ error: 'Cannot delete main branch' });
    }

    // Cannot delete current branch
    if (name === currentBranch) {
      return reply.code(400).send({
        error: 'Cannot delete current branch. Switch to another branch first.'
      });
    }

    try {
      const branch = metaDb.prepare(`
        SELECT * FROM branches WHERE name = ?
      `).get(name);

      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      // Close connection if exists
      closeBranchConnection(fastify.projectPath, name);

      // Delete branch record (cascade will handle related data)
      metaDb.prepare(`
        DELETE FROM branches WHERE name = ?
      `).run(name);

      // Delete related data
      metaDb.prepare(`DELETE FROM migrations WHERE branch = ?`).run(name);
      metaDb.prepare(`DELETE FROM events WHERE branch = ?`).run(name);
      metaDb.prepare(`DELETE FROM snapshots WHERE branch = ?`).run(name);

      // Note: We don't delete the DB file for safety
      // Users can manually delete if needed

      // Log event in current branch
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'branch_deleted', ?)
      `).run(currentBranch, JSON.stringify({ branch: name }));

      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Get branch statistics (migrations applied, snapshots, etc.)
   */
  fastify.get('/:name/stats', async (request, reply) => {
    const { name } = request.params;
    const metaDb = fastify.getMetaDb();

    try {
      const branch = metaDb.prepare(`
        SELECT * FROM branches WHERE name = ?
      `).get(name);

      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      const migrationsCount = metaDb.prepare(`
        SELECT COUNT(*) as count FROM migrations WHERE branch = ?
      `).get(name);

      const snapshotsCount = metaDb.prepare(`
        SELECT COUNT(*) as count FROM snapshots WHERE branch = ?
      `).get(name);

      const eventsCount = metaDb.prepare(`
        SELECT COUNT(*) as count FROM events WHERE branch = ?
      `).get(name);

      return {
        ...branch,
        stats: {
          migrations_applied: migrationsCount.count,
          snapshots: snapshotsCount.count,
          events: eventsCount.count
        }
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}
