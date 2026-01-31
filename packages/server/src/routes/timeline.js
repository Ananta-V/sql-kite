export default async function timelineRoutes(fastify, options) {
  // Get timeline events
  fastify.get('/', async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query;
    const metaDb = fastify.getMetaDb();
    
    const events = metaDb.prepare(`
      SELECT id, type, data, created_at
      FROM events
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(limit), parseInt(offset));
    
    const totalResult = metaDb.prepare(`SELECT COUNT(*) as total FROM events`).get();
    
    return {
      events: events.map(event => ({
        id: event.id,
        type: event.type,
        data: JSON.parse(event.data),
        createdAt: event.created_at
      })),
      total: totalResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
  });
  
  // Clear timeline
  fastify.delete('/', async (request, reply) => {
    const metaDb = fastify.getMetaDb();
    
    metaDb.prepare(`DELETE FROM events`).run();
    
    return { success: true };
  });
}