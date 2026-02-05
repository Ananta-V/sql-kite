import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import  crypto from 'crypto';

export default async function migrationsRoutes(fastify, options) {
  // List all migrations
  fastify.get('/', async (request, reply) => {
    const migrationsPath = join(fastify.projectPath, 'migrations');
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      // Ensure migrations directory exists
      if (!existsSync(migrationsPath)) {
        return [];
      }

      const files = readdirSync(migrationsPath).filter(f => f.endsWith('.sql')).sort();

      const applied = metaDb.prepare(`
        SELECT filename, applied_at FROM migrations WHERE branch = ? ORDER BY id
      `).all(currentBranch);

      const appliedMap = new Map(applied.map(m => [m.filename, m.applied_at]));

      return files.map(filename => {
        const filePath = join(migrationsPath, filename);
        const content = readFileSync(filePath, 'utf-8');
        const stats = statSync(filePath);
        const checksum = crypto.createHash('sha256').update(content).digest('hex');
        const appliedAt = appliedMap.get(filename);

        return {
          filename,
          applied: appliedMap.has(filename),
          content,
          branch: currentBranch,
          created_at: stats.birthtime.toISOString(),
          applied_at: appliedAt || null,
          checksum,
          author: 'LocalDB'
        };
      });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Create a new migration file
  fastify.post('/create', async (request, reply) => {
    const { name, sql } = request.body;
    const migrationsPath = join(fastify.projectPath, 'migrations');
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    if (!name || !sql) {
      return reply.code(400).send({ error: 'Name and SQL are required' });
    }

    try {
      // Ensure migrations directory exists
      if (!existsSync(migrationsPath)) {
        mkdirSync(migrationsPath, { recursive: true });
      }

      // Get next migration number
      const existingFiles = readdirSync(migrationsPath).filter(f => f.endsWith('.sql'));
      const numbers = existingFiles
        .map(f => parseInt(f.split('_')[0]))
        .filter(n => !isNaN(n));
      const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

      // Create filename
      const filename = `${String(nextNum).padStart(3, '0')}_${name}.sql`;
      const filePath = join(migrationsPath, filename);

      // Write migration file
      writeFileSync(filePath, sql, 'utf-8');

      // Log event in current branch
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'migration_created', ?)
      `).run(currentBranch, JSON.stringify({ filename, name }));

      return {
        success: true,
        filename,
        path: filePath
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Apply migration
  fastify.post('/apply', async (request, reply) => {
    const { filename } = request.body;
    const migrationsPath = join(fastify.projectPath, 'migrations');
    const db = fastify.getUserDb();
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      // Check if already applied in this branch
      const existing = metaDb.prepare(`
        SELECT id FROM migrations WHERE branch = ? AND filename = ?
      `).get(currentBranch, filename);

      if (existing) {
        return reply.code(400).send({ error: 'Migration already applied in this branch' });
      }

      // Read and execute migration
      const sql = readFileSync(join(migrationsPath, filename), 'utf-8');
      db.exec(sql);

      // Mark as applied in this branch
      metaDb.prepare(`
        INSERT INTO migrations (branch, filename) VALUES (?, ?)
      `).run(currentBranch, filename);

      // Log event in this branch
      metaDb.prepare(`
        INSERT INTO events (branch, type, data)
        VALUES (?, 'migration_applied', ?)
      `).run(currentBranch, JSON.stringify({ filename }));

      return { success: true, branch: currentBranch };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Apply all pending migrations
  fastify.post('/apply-all', async (request, reply) => {
    const migrationsPath = join(fastify.projectPath, 'migrations');
    const db = fastify.getUserDb();
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      const allFiles = readdirSync(migrationsPath).filter(f => f.endsWith('.sql')).sort();

      const applied = metaDb.prepare(`
        SELECT filename FROM migrations WHERE branch = ?
      `).all(currentBranch);

      const appliedSet = new Set(applied.map(m => m.filename));
      const pendingFiles = allFiles.filter(f => !appliedSet.has(f));

      const results = [];

      for (const filename of pendingFiles) {
        try {
          const sql = readFileSync(join(migrationsPath, filename), 'utf-8');
          db.exec(sql);

          metaDb.prepare(`
            INSERT INTO migrations (branch, filename) VALUES (?, ?)
          `).run(currentBranch, filename);

          metaDb.prepare(`
            INSERT INTO events (branch, type, data)
            VALUES (?, 'migration_applied', ?)
          `).run(currentBranch, JSON.stringify({ filename }));

          results.push({ filename, success: true });
        } catch (error) {
          results.push({ filename, success: false, error: error.message });
          // Stop on first error
          break;
        }
      }

      return {
        success: true,
        branch: currentBranch,
        applied: results
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}