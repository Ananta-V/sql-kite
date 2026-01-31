export default async function schemaRoutes(fastify, options) {
  // Get full database schema
  fastify.get('/', async (request, reply) => {
    const db = fastify.getUserDb();
    
    const schema = db.prepare(`
      SELECT type, name, sql
      FROM sqlite_master
      WHERE sql NOT NULL
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_studio_%'
      ORDER BY type, name
    `).all();
    
    return {
      tables: schema.filter(s => s.type === 'table'),
      indexes: schema.filter(s => s.type === 'index'),
      views: schema.filter(s => s.type === 'view'),
      triggers: schema.filter(s => s.type === 'trigger')
    };
  });
  
  // Get foreign keys for a table
  fastify.get('/foreign-keys/:tableName', async (request, reply) => {
    const { tableName } = request.params;
    const db = fastify.getUserDb();
    
    try {
      const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all();
      return foreignKeys;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
  
  // Get indexes for a table
  fastify.get('/indexes/:tableName', async (request, reply) => {
    const { tableName } = request.params;
    const db = fastify.getUserDb();
    
    try {
      const indexes = db.prepare(`PRAGMA index_list(${tableName})`).all();
      return indexes;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}