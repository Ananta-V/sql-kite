export default async function tablesRoutes(fastify, options) {
  // List all tables
  fastify.get('/', async (request, reply) => {
    const db = fastify.getUserDb();
    
    const tables = db.prepare(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_studio_%'
      ORDER BY name
    `).all();
    
    return tables.map(table => ({
      name: table.name,
      sql: table.sql
    }));
  });
  
  // Get table info
  fastify.get('/:tableName', async (request, reply) => {
    const { tableName } = request.params;
    const db = fastify.getUserDb();
    
    try {
      // Get columns
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      
      // Get row count
      const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      
      // Get CREATE statement
      const tableInfo = db.prepare(`
        SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?
      `).get(tableName);
      
      return {
        name: tableName,
        columns: columns.map(col => ({
          name: col.name,
          type: col.type,
          notNull: col.notnull === 1,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1
        })),
        rowCount: countResult.count,
        sql: tableInfo?.sql
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
  
  // Get table data with pagination
  fastify.get('/:tableName/data', async (request, reply) => {
    const { tableName } = request.params;
    const { limit = 100, offset = 0 } = request.query;
    const db = fastify.getUserDb();
    
    try {
      const rows = db.prepare(`
        SELECT * FROM ${tableName}
        LIMIT ? OFFSET ?
      `).all(parseInt(limit), parseInt(offset));
      
      const totalResult = db.prepare(`SELECT COUNT(*) as total FROM ${tableName}`).get();
      
      return {
        data: rows,
        total: totalResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
  
  // Create table
  fastify.post('/', async (request, reply) => {
    const { sql } = request.body;
    const db = fastify.getUserDb();
    const metaDb = fastify.getMetaDb();
    
    try {
      db.exec(sql);
      
      // Log event
      metaDb.prepare(`
        INSERT INTO events (type, data)
        VALUES ('table_created', ?)
      `).run(JSON.stringify({ sql }));
      
      return { success: true };
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });
  
  // Drop table
  fastify.delete('/:tableName', async (request, reply) => {
    const { tableName } = request.params;
    const db = fastify.getUserDb();
    const metaDb = fastify.getMetaDb();
    
    try {
      db.exec(`DROP TABLE ${tableName}`);
      
      // Log event
      metaDb.prepare(`
        INSERT INTO events (type, data)
        VALUES ('table_dropped', ?)
      `).run(JSON.stringify({ tableName }));
      
      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}