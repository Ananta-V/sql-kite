import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export default async function migrationsRoutes(fastify, options) {
  // List all migrations
  fastify.get('/', async (request, reply) => {
    const migrationsPath = join(fastify.projectPath, 'migrations');
    const metaDb = fastify.getMetaDb();
    
    try {
      const files = readdirSync(migrationsPath).filter(f => f.endsWith('.sql')).sort();
      
      const applied = metaDb.prepare(`
        SELECT filename FROM migrations ORDER BY id
      `).all();
      
      const appliedSet = new Set(applied.map(m => m.filename));
      
      return files.map(filename => {
        const content = readFileSync(join(migrationsPath, filename), 'utf-8');
        return {
          filename,
          applied: appliedSet.has(filename),
          content
        };
      });
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
    
    try {
      // Check if already applied
      const existing = metaDb.prepare(`
        SELECT id FROM migrations WHERE filename = ?
      `).get(filename);
      
      if (existing) {
        return reply.code(400).send({ error: 'Migration already applied' });
      }
      
      // Read and execute migration
      const sql = readFileSync(join(migrationsPath, filename), 'utf-8');
      db.exec(sql);
      
      // Mark as applied
      metaDb.prepare(`
        INSERT INTO migrations (filename) VALUES (?)
      `).run(filename);
      
      // Log event
      metaDb.prepare(`
        INSERT INTO events (type, data)
        VALUES ('migration_applied', ?)
      `).run(JSON.stringify({ filename }));
      
      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}