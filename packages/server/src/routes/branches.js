import { copyFileSync, existsSync, mkdirSync } from 'fs';
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
   * 
   * RULE: Every branch must be created from an existing branch.
   * No empty databases. No undefined states.
   */
  fastify.post('/create', async (request, reply) => {
    const { name, description, baseBranch } = request.body;
    const metaDb = fastify.getMetaDb();
    const currentBranch = getCurrentBranch(fastify.projectPath);

    // Validate branch name
    if (!name || !/^[a-zA-Z0-9_/-]+$/.test(name)) {
      return reply.code(400).send({
        error: 'Invalid branch name. Use only letters, numbers, hyphens, slashes, and underscores.'
      });
    }

    // Base branch is REQUIRED - no exceptions
    if (!baseBranch) {
      return reply.code(400).send({
        error: 'Base branch is required. Every branch must be created from an existing branch.'
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
      // Get source branch DB file
      const sourceInfo = metaDb.prepare(`
        SELECT db_file FROM branches WHERE name = ?
      `).get(baseBranch);

      if (!sourceInfo) {
        return reply.code(404).send({ error: `Base branch "${baseBranch}" not found` });
      }

      const sourceDbPath = join(fastify.projectPath, sourceInfo.db_file);
      // Sanitize branch name for filename: replace slashes with hyphens
      const safeDbName = name.replace(/\//g, '-');
      const newDbFile = `${safeDbName}.db.sqlite`;
      const newDbPath = join(fastify.projectPath, newDbFile);

      // CRITICAL: Checkpoint WAL to ensure clean snapshot
      // This freezes the base branch state at this exact moment
      try {
        const sourceDb = fastify.getUserDb(baseBranch);
        sourceDb.pragma('wal_checkpoint(TRUNCATE)');
      } catch (walError) {
        console.warn('WAL checkpoint warning:', walError.message);
      }

      // Copy database file (full snapshot)
      copyFileSync(sourceDbPath, newDbPath);

      // Copy WAL and SHM files if they exist (though checkpoint should have cleared them)
      ['.wal', '.shm'].forEach(ext => {
        const sourceWalPath = sourceDbPath + ext;
        const newWalPath = newDbPath + ext;
        if (existsSync(sourceWalPath)) {
          copyFileSync(sourceWalPath, newWalPath);
        }
      });

      // Get snapshot metadata (file size, etc.)
      const { statSync } = await import('fs');
      const dbStats = statSync(newDbPath);
      const snapshotTime = new Date().toISOString();

      // Ensure snapshots directory exists
      const snapshotsDir = join(fastify.projectPath, '.studio', 'snapshots');
      if (!existsSync(snapshotsDir)) {
        mkdirSync(snapshotsDir, { recursive: true });
      }

      // Create branch record with full metadata
      metaDb.prepare(`
        INSERT INTO branches (name, db_file, created_from, description)
        VALUES (?, ?, ?, ?)
      `).run(name, newDbFile, baseBranch, description || '');

      // Create implicit snapshot for this branch creation
      // This gives us traceability and restore capability
      const snapshotFilename = `${name}-creation-${Date.now()}.snapshot.db`;
      copyFileSync(newDbPath, join(fastify.projectPath, '.studio', 'snapshots', snapshotFilename));

      metaDb.prepare(`
        INSERT INTO snapshots (branch, filename, name, size, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, snapshotFilename, 'Branch Creation', dbStats.size, `Initial state copied from ${baseBranch}`);

      // Log event in BOTH branches for full traceability
      
      // Event in source branch: "I was the base for a new branch"
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'branch_created_from_here', ?)
      `).run(baseBranch, JSON.stringify({
        new_branch: name,
        created_at: snapshotTime
      }));

      // Event in new branch: "I was created from a base branch"
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'branch_created', ?)
      `).run(name, JSON.stringify({
        base_branch: baseBranch,
        created_at: snapshotTime
      }));

      return {
        success: true,
        branch: {
          name,
          db_file: newDbFile,
          created_from: baseBranch,
          created_at: snapshotTime,
          snapshot_created: true
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

  /**
   * Promote a branch to another branch
   * 
   * Philosophy: Promote states, not scripts.
   * This replaces the target branch DB with the source branch DB.
   */
  fastify.post('/promote', async (request, reply) => {
    const { sourceBranch, targetBranch, createSnapshot = true } = request.body;
    const metaDb = fastify.getMetaDb();
    const currentBranch = getCurrentBranch(fastify.projectPath);

    // Validation
    if (!sourceBranch || !targetBranch) {
      return reply.code(400).send({ error: 'Source and target branches required' });
    }

    if (sourceBranch === targetBranch) {
      return reply.code(400).send({ error: 'Source and target must be different' });
    }

    try {
      // Get both branch info
      const source = metaDb.prepare(`
        SELECT * FROM branches WHERE name = ?
      `).get(sourceBranch);

      const target = metaDb.prepare(`
        SELECT * FROM branches WHERE name = ?
      `).get(targetBranch);

      if (!source) {
        return reply.code(404).send({ error: `Source branch "${sourceBranch}" not found` });
      }

      if (!target) {
        return reply.code(404).send({ error: `Target branch "${targetBranch}" not found` });
      }

      const sourceDbPath = join(fastify.projectPath, source.db_file);
      const targetDbPath = join(fastify.projectPath, target.db_file);

      // WAL checkpoint on both branches
      try {
        const sourceDb = fastify.getUserDb(sourceBranch);
        const targetDb = fastify.getUserDb(targetBranch);
        sourceDb.pragma('wal_checkpoint(TRUNCATE)');
        targetDb.pragma('wal_checkpoint(TRUNCATE)');
      } catch (walError) {
        console.warn('WAL checkpoint warning:', walError.message);
      }

      // Close connections before file operations
      closeBranchConnection(fastify.projectPath, sourceBranch);
      closeBranchConnection(fastify.projectPath, targetBranch);

      // Create snapshot of target before promotion (if requested)
      let snapshotId = null;
      if (createSnapshot) {
        const snapshotsDir = join(fastify.projectPath, '.studio', 'snapshots');
        if (!existsSync(snapshotsDir)) {
          mkdirSync(snapshotsDir, { recursive: true });
        }

        const snapshotFilename = `${targetBranch}-pre-promote-${Date.now()}.snapshot.db`;
        const snapshotPath = join(snapshotsDir, snapshotFilename);
        copyFileSync(targetDbPath, snapshotPath);

        const { statSync } = await import('fs');
        const snapshotStats = statSync(snapshotPath);

        const result = metaDb.prepare(`
          INSERT INTO snapshots (branch, filename, name, size, description, type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          targetBranch,
          snapshotFilename,
          `Before promoting ${sourceBranch}`,
          snapshotStats.size,
          `Automatic snapshot before promoting ${sourceBranch} to ${targetBranch}`,
          'auto-before-promote'
        );

        snapshotId = result.lastInsertRowid;
      }

      // Replace target DB with source DB
      copyFileSync(sourceDbPath, targetDbPath);

      // Also copy WAL and SHM files
      ['.wal', '.shm'].forEach(ext => {
        const sourceWalPath = sourceDbPath + ext;
        const targetWalPath = targetDbPath + ext;
        if (existsSync(sourceWalPath)) {
          copyFileSync(sourceWalPath, targetWalPath);
        }
      });

      const promotionTime = new Date().toISOString();

      // Log promotion event in target branch
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'branch_promoted', ?)
      `).run(targetBranch, JSON.stringify({
        source: sourceBranch,
        target: targetBranch,
        promoted_at: promotionTime,
        snapshot_id: snapshotId
      }));

      // Log in source branch that it was promoted
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'branch_promoted_from_here', ?)
      `).run(sourceBranch, JSON.stringify({
        source: sourceBranch,
        target: targetBranch,
        promoted_at: promotionTime
      }));

      return {
        success: true,
        source: sourceBranch,
        target: targetBranch,
        snapshot_created: createSnapshot,
        snapshot_id: snapshotId
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}
