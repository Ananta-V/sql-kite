import { getReadOnlyUserDb, closeReadOnlyBranchConnection, getUserDb } from '../db/connections.js';

function stripSqlComments(sql) {
  const withoutBlock = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return withoutBlock.replace(/--.*$/gm, ' ');
}

function hasForbiddenKeyword(sql) {
  const forbidden = /(\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bDROP\b|\bCREATE\b|\bTRUNCATE\b|\bATTACH\b)/i;
  return forbidden.test(sql);
}

function shouldInjectLimit(sql) {
  return !/\blimit\b/i.test(sql);
}

function injectLimit(sql, limit) {
  const trimmed = sql.trim();
  const hasSemicolon = trimmed.endsWith(';');
  const base = hasSemicolon ? trimmed.slice(0, -1) : trimmed;
  return `${base} LIMIT ${limit}${hasSemicolon ? ';' : ''}`;
}

function getStatementType(sql) {
  const cleaned = stripSqlComments(sql).trim();
  const match = cleaned.match(/^(\w+)/i);
  return match ? match[1].toUpperCase() : '';
}

export default async function compareRoutes(fastify) {
  // Force WAL checkpoint for branches before compare mode
  fastify.post('/checkpoint', async (request, reply) => {
    const { branches } = request.body || {};
    if (!Array.isArray(branches) || branches.length === 0) {
      return reply.code(400).send({ error: 'branches is required' });
    }

    try {
      branches.forEach((branch) => {
        const db = getUserDb(fastify.projectPath, branch);
        db.pragma('wal_checkpoint(TRUNCATE)');
      });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Execute a read-only compare query against a branch
  fastify.post('/query', async (request, reply) => {
    const { sql, branch } = request.body || {};

    if (!branch) {
      return reply.code(400).send({ error: 'branch is required' });
    }

    if (!sql || sql.trim() === '') {
      return reply.code(400).send({ error: 'SQL query is required' });
    }

    const cleaned = stripSqlComments(sql);
    if (hasForbiddenKeyword(cleaned)) {
      return reply.code(400).send({ error: 'Write operations are disabled in Compare Mode' });
    }

    const statementType = getStatementType(cleaned);
    const allowed = ['SELECT', 'PRAGMA', 'EXPLAIN', 'WITH'];
    if (!allowed.includes(statementType)) {
      return reply.code(400).send({ error: 'Write operations are disabled in Compare Mode' });
    }

    const startTime = Date.now();

    try {
      const db = getReadOnlyUserDb(fastify.projectPath, branch);
      let sqlToRun = sql;

      if ((statementType === 'SELECT' || statementType === 'WITH') && shouldInjectLimit(sql)) {
        sqlToRun = injectLimit(sql, 500);
      }

      const rows = db.prepare(sqlToRun).all();
      return {
        type: 'select',
        rows,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return reply.code(400).send({ error: error.message, sql });
    }
  });

  // Close compare connections
  fastify.post('/close', async (request, reply) => {
    const { branches } = request.body || {};
    if (!Array.isArray(branches) || branches.length === 0) {
      return reply.code(400).send({ error: 'branches is required' });
    }

    try {
      branches.forEach((branch) => {
        closeReadOnlyBranchConnection(fastify.projectPath, branch);
      });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  });
}
