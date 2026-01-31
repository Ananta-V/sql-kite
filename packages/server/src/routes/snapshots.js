import { readdirSync, copyFileSync, statSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

export default async function snapshotsRoutes(fastify, options) {
  // List snapshots
  fastify.get('/', async (request, reply) => {
    const snapshotsPath = join(fastify.projectPath, 'snapshots');
    const metaDb = fastify.getMetaDb();
    
    try {
      const snapshots = metaDb.prepare(`
        SELECT * FROM snapshots ORDER BY id DESC
      `).all();
      
      return snapshots.map(snapshot => {
        const filePath = join(snapshotsPath, snapshot.filename);
        const stats = statSync(filePath);
        
        return {
          id: snapshot.id,
          filename: snapshot.filename,
          size: snapshot.size,
          createdAt: snapshot.created_at,
          exists: stats.isFile()
        };
      });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
  
  // Create snapshot
  fastify.post('/', async (request, reply) => {
    const { name } = request.body;
    const snapshotsPath = join(fastify.projectPath, 'snapshots');
    const dbPath = join(fastify.projectPath, 'db.sqlite');
    const metaDb = fastify.getMetaDb();
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = name 
        ? `${name}-${timestamp}.db`
        : `snapshot-${timestamp}.db`;
      
      const snapshotPath = join(snapshotsPath, filename);
      
      // Copy database file
      copyFileSync(dbPath, snapshotPath);
      
      const stats = statSync(snapshotPath);
      
      // Record snapshot
      const result = metaDb.prepare(`
        INSERT INTO snapshots (filename, size) VALUES (?, ?)
      `).run(filename, stats.size);
      
      // Log event
      metaDb.prepare(`
        INSERT INTO events (type, data)
        VALUES ('snapshot_created', ?)
      `).run(JSON.stringify({ filename, size: stats.size }));
      
      return {
        id: result.lastInsertRowid,
        filename,
        size: stats.size
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
  
  // Restore snapshot
  fastify.post('/restore/:id', async (request, reply) => {
    const { id } = request.params;
    const snapshotsPath = join(fastify.projectPath, 'snapshots');
    const dbPath = join(fastify.projectPath, 'db.sqlite');
    const metaDb = fastify.getMetaDb();
    
    try {
      const snapshot = metaDb.prepare(`
        SELECT * FROM snapshots WHERE id = ?
      `).get(id);
      
      if (!snapshot) {
        return reply.code(404).send({ error: 'Snapshot not found' });
      }
      
      const snapshotPath = join(snapshotsPath, snapshot.filename);
      
      // Close user DB connection
      const userDb = fastify.getUserDb();
      userDb.close();
      
      // Copy snapshot to db.sqlite
      copyFileSync(snapshotPath, dbPath);
      
      // Log event
      metaDb.prepare(`
        INSERT INTO events (type, data)
        VALUES ('snapshot_restored', ?)
      `).run(JSON.stringify({ 
        snapshotId: id, 
        filename: snapshot.filename 
      }));
      
      return { 
        success: true,
        message: 'Server will restart...'
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}