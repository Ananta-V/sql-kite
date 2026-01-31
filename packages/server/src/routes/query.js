export default async function queryRoutes(fastify, options) {
  // Execute SQL query
  fastify.post('/', async (request, reply) => {
    const { sql } = request.body;
    const db = fastify.getUserDb();
    const metaDb = fastify.getMetaDb();
    
    if (!sql || sql.trim() === '') {
      return reply.code(400).send({ error: 'SQL query is required' });
    }
    
    const startTime = Date.now();
    
    try {
      const trimmedSql = sql.trim().toUpperCase();
      let result;
      
      // Determine query type
      if (trimmedSql.startsWith('SELECT') || trimmedSql.startsWith('PRAGMA')) {
        // Read query
        result = {
          type: 'select',
          rows: db.prepare(sql).all(),
          executionTime: Date.now() - startTime
        };
      } else {
        // Write query (INSERT, UPDATE, DELETE, CREATE, etc.)
        const info = db.prepare(sql).run();
        result = {
          type: 'write',
          changes: info.changes,
          lastInsertRowid: info.lastInsertRowid,
          executionTime: Date.now() - startTime
        };
      }
      
      // Log to timeline
      metaDb.prepare(`
        INSERT INTO events (type, data)
        VALUES ('sql_executed', ?)
      `).run(JSON.stringify({
        sql,
        type: result.type,
        executionTime: result.executionTime,
        changes: result.changes,
        rowCount: result.rows?.length
      }));
      
      return result;
    } catch (error) {
      // Log error
      metaDb.prepare(`
        INSERT INTO events (type, data)
        VALUES ('sql_error', ?)
      `).run(JSON.stringify({
        sql,
        error: error.message,
        executionTime: Date.now() - startTime
      }));
      
      return reply.code(400).send({
        error: error.message,
        sql
      });
    }
  });
}