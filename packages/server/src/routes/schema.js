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

  // Export full schema as SQL (state-based, not history)
  fastify.get('/export', async (request, reply) => {
    const db = fastify.getUserDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      // Get all schema objects
      const schema = db.prepare(`
        SELECT type, name, sql
        FROM sqlite_master
        WHERE sql NOT NULL
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '_studio_%'
        ORDER BY 
          CASE type
            WHEN 'table' THEN 1
            WHEN 'index' THEN 2
            WHEN 'view' THEN 3
            WHEN 'trigger' THEN 4
            ELSE 5
          END,
          name
      `).all();

      // Build SQL export
      let exportSql = `-- Full schema export\\n`;
      exportSql += `-- Branch: ${currentBranch}\\n`;
      exportSql += `-- Generated: ${new Date().toISOString()}\\n`;
      exportSql += `-- \\n`;
      exportSql += `-- This is current database state, not migration history.\\n`;
      exportSql += `\\n`;

      let currentType = null;

      for (const obj of schema) {
        // Add section headers
        if (obj.type !== currentType) {
          currentType = obj.type;
          exportSql += `\\n-- ========================================\\n`;
          exportSql += `-- ${obj.type.toUpperCase()}S\\n`;
          exportSql += `-- ========================================\\n\\n`;
        }

        exportSql += `-- ${obj.name}\\n`;
        exportSql += obj.sql + ';\\n\\n';
      }

      const projectName = fastify.projectPath.split(/[\\\\/]/).pop();
      const filename = `${projectName}_${currentBranch}_schema.sql`;

      reply.header('Content-Type', 'text/plain');
      reply.header('Content-Disposition', `attachment; filename=\"${filename}\"`);
      
      return exportSql;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get ER diagram data (tables + columns + foreign key relations)
  fastify.get('/er', async (request, reply) => {
    const db = fastify.getUserDb();

    try {
      // Get all tables (excluding SQLite internal tables)
      const tables = db.prepare(`
        SELECT name 
        FROM sqlite_master 
        WHERE type='table' 
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '_studio_%'
        ORDER BY name
      `).all();

      const tablesWithColumns = [];
      const relations = [];

      for (const table of tables) {
        // Get column info
        const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
        
        // Get foreign keys
        const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${table.name})`).all();

        // Map columns to our format
        const formattedColumns = columns.map(col => ({
          name: col.name,
          type: col.type,
          pk: col.pk === 1,
          notnull: col.notnull === 1,
          dflt_value: col.dflt_value
        }));

        tablesWithColumns.push({
          name: table.name,
          columns: formattedColumns
        });

        // Map foreign keys to relations
        for (const fk of foreignKeys) {
          relations.push({
            from: `${table.name}.${fk.from}`,
            to: `${fk.table}.${fk.to}`,
            fromTable: table.name,
            toTable: fk.table,
            fromColumn: fk.from,
            toColumn: fk.to
          });
        }
      }

      return {
        tables: tablesWithColumns,
        relations
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}