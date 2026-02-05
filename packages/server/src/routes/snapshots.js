import { copyFileSync, statSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { closeBranchConnection } from '../db/connections.js';

export default async function snapshotsRoutes(fastify, options) {
  /**
   * List snapshots for current branch
   */
  fastify.get('/', async (request, reply) => {
    const snapshotsPath = join(fastify.projectPath, 'snapshots');
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      // Ensure snapshots directory exists
      if (!existsSync(snapshotsPath)) {
        mkdirSync(snapshotsPath, { recursive: true });
      }

      // Get snapshots for current branch only
      const snapshots = metaDb.prepare(`
        SELECT * FROM snapshots
        WHERE branch = ?
        ORDER BY id DESC
      `).all(currentBranch);

      return snapshots.map(snapshot => {
        const filePath = join(snapshotsPath, snapshot.filename);
        let exists = false;
        let size = snapshot.size;

        try {
          const stats = statSync(filePath);
          exists = stats.isFile();
          size = stats.size;
        } catch (e) {
          exists = false;
        }

        return {
          id: snapshot.id,
          branch: snapshot.branch,
          filename: snapshot.filename,
          name: snapshot.name,
          description: snapshot.description,
          size,
          createdAt: snapshot.created_at,
          exists
        };
      });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Create snapshot from current branch
   */
  fastify.post('/', async (request, reply) => {
    const { name, description } = request.body;
    const snapshotsPath = join(fastify.projectPath, 'snapshots');
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    if (!name) {
      return reply.code(400).send({ error: 'Snapshot name is required' });
    }

    try {
      // Ensure snapshots directory exists
      if (!existsSync(snapshotsPath)) {
        mkdirSync(snapshotsPath, { recursive: true });
      }

      // Get current branch's DB file
      const branchInfo = metaDb.prepare(`
        SELECT db_file FROM branches WHERE name = ?
      `).get(currentBranch);

      if (!branchInfo) {
        return reply.code(404).send({ error: 'Current branch not found' });
      }

      const sourceDbPath = join(fastify.projectPath, branchInfo.db_file);

      // Create snapshot filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const snapshotFilename = `${currentBranch}-${sanitizedName}-${timestamp}.db`;
      const snapshotPath = join(snapshotsPath, snapshotFilename);

      // Checkpoint WAL before copying (ensures all data is in main DB file)
      const db = fastify.getUserDb();
      db.pragma('wal_checkpoint(FULL)');

      // Copy database file
      copyFileSync(sourceDbPath, snapshotPath);

      // Get file size
      const stats = statSync(snapshotPath);

      // Record snapshot in meta DB
      const result = metaDb.prepare(`
        INSERT INTO snapshots (branch, filename, name, size, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(currentBranch, snapshotFilename, name, stats.size, description || '');

      // Log event
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'snapshot_created', ?)
      `).run(currentBranch, JSON.stringify({
        name,
        filename: snapshotFilename,
        size: stats.size
      }));

      return {
        id: result.lastInsertRowid,
        branch: currentBranch,
        filename: snapshotFilename,
        name,
        size: stats.size,
        description: description || ''
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Restore snapshot (current branch only)
   */
  fastify.post('/restore/:id', async (request, reply) => {
    const { id } = request.params;
    const snapshotsPath = join(fastify.projectPath, 'snapshots');
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      // Get snapshot
      const snapshot = metaDb.prepare(`
        SELECT * FROM snapshots WHERE id = ?
      `).get(id);

      if (!snapshot) {
        return reply.code(404).send({ error: 'Snapshot not found' });
      }

      // Verify snapshot belongs to current branch
      if (snapshot.branch !== currentBranch) {
        return reply.code(400).send({
          error: `Cannot restore snapshot from "${snapshot.branch}" while on "${currentBranch}". Switch branches first.`
        });
      }

      const snapshotPath = join(snapshotsPath, snapshot.filename);

      // Verify snapshot file exists
      if (!existsSync(snapshotPath)) {
        return reply.code(404).send({ error: 'Snapshot file not found' });
      }

      // Get current branch's DB file
      const branchInfo = metaDb.prepare(`
        SELECT db_file FROM branches WHERE name = ?
      `).get(currentBranch);

      if (!branchInfo) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      const dbPath = join(fastify.projectPath, branchInfo.db_file);

      // Close current branch DB connection
      closeBranchConnection(fastify.projectPath, currentBranch);

      // Copy snapshot over current DB
      copyFileSync(snapshotPath, dbPath);

      // Also remove WAL and SHM files (force fresh start)
      ['.wal', '.shm'].forEach(ext => {
        const walPath = dbPath + ext;
        if (existsSync(walPath)) {
          try {
            unlinkSync(walPath);
          } catch (e) {
            // Ignore
          }
        }
      });

      // Log restore event
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'snapshot_restored', ?)
      `).run(currentBranch, JSON.stringify({
        snapshot_id: id,
        snapshot_name: snapshot.name,
        filename: snapshot.filename
      }));

      return {
        success: true,
        message: 'Snapshot restored successfully',
        snapshot: {
          id: snapshot.id,
          name: snapshot.name,
          branch: snapshot.branch
        }
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Delete snapshot
   */
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;
    const snapshotsPath = join(fastify.projectPath, 'snapshots');
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      const snapshot = metaDb.prepare(`
        SELECT * FROM snapshots WHERE id = ?
      `).get(id);

      if (!snapshot) {
        return reply.code(404).send({ error: 'Snapshot not found' });
      }

      // Optional: Only allow deleting snapshots from current branch
      if (snapshot.branch !== currentBranch) {
        return reply.code(400).send({
          error: `Cannot delete snapshot from "${snapshot.branch}" while on "${currentBranch}"`
        });
      }

      // Delete from meta DB
      metaDb.prepare(`DELETE FROM snapshots WHERE id = ?`).run(id);

      // Note: We don't delete the actual file for safety
      // Users can manually delete snapshot files if needed

      // Log event
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'snapshot_deleted', ?)
      `).run(currentBranch, JSON.stringify({
        snapshot_id: id,
        snapshot_name: snapshot.name
      }));

      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Get snapshot details
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const snapshotsPath = join(fastify.projectPath, 'snapshots');
    const metaDb = fastify.getMetaDb();

    try {
      const snapshot = metaDb.prepare(`
        SELECT * FROM snapshots WHERE id = ?
      `).get(id);

      if (!snapshot) {
        return reply.code(404).send({ error: 'Snapshot not found' });
      }

      const filePath = join(snapshotsPath, snapshot.filename);
      let exists = false;
      let size = snapshot.size;

      try {
        const stats = statSync(filePath);
        exists = stats.isFile();
        size = stats.size;
      } catch (e) {
        exists = false;
      }

      return {
        id: snapshot.id,
        branch: snapshot.branch,
        filename: snapshot.filename,
        name: snapshot.name,
        description: snapshot.description,
        size,
        createdAt: snapshot.created_at,
        exists
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}
