export default async function timelineRoutes(fastify, options) {
  /**
   * Get timeline events for current branch
   */
  fastify.get('/', async (request, reply) => {
    const { limit = 50, offset = 0, all_branches } = request.query;
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      let events, totalResult;

      if (all_branches === 'true') {
        // Show events from all branches
        events = metaDb.prepare(`
          SELECT id, branch, type, data, created_at
          FROM events
          ORDER BY id DESC
          LIMIT ? OFFSET ?
        `).all(parseInt(limit), parseInt(offset));

        totalResult = metaDb.prepare(`SELECT COUNT(*) as total FROM events`).get();
      } else {
        // Show events from current branch only (default)
        events = metaDb.prepare(`
          SELECT id, branch, type, data, created_at
          FROM events
          WHERE branch = ?
          ORDER BY id DESC
          LIMIT ? OFFSET ?
        `).all(currentBranch, parseInt(limit), parseInt(offset));

        totalResult = metaDb.prepare(`
          SELECT COUNT(*) as total FROM events WHERE branch = ?
        `).get(currentBranch);
      }

      return {
        events: events.map(event => ({
          id: event.id,
          branch: event.branch,
          type: event.type,
          data: JSON.parse(event.data),
          createdAt: event.created_at,
          isCurrentBranch: event.branch === currentBranch
        })),
        currentBranch,
        total: totalResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Clear timeline for current branch
   */
  fastify.delete('/', async (request, reply) => {
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      metaDb.prepare(`DELETE FROM events WHERE branch = ?`).run(currentBranch);

      return {
        success: true,
        branch: currentBranch,
        message: `Timeline cleared for branch "${currentBranch}"`
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * Get timeline summary/stats
   */
  fastify.get('/stats', async (request, reply) => {
    const metaDb = fastify.getMetaDb();
    const currentBranch = fastify.getCurrentBranch();

    try {
      const stats = metaDb.prepare(`
        SELECT
          type,
          COUNT(*) as count
        FROM events
        WHERE branch = ?
        GROUP BY type
        ORDER BY count DESC
      `).all(currentBranch);

      const totalEvents = metaDb.prepare(`
        SELECT COUNT(*) as total FROM events WHERE branch = ?
      `).get(currentBranch);

      return {
        branch: currentBranch,
        total: totalEvents.total,
        by_type: stats
      };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}