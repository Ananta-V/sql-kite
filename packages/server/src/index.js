import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { createRequire } from 'module';

import { getUserDb, getMetaDb, getCurrentBranch } from './db/connections.js';
import tablesRoutes from './routes/tables.js';
import queryRoutes from './routes/query.js';
import schemaRoutes from './routes/schema.js';
import timelineRoutes from './routes/timeline.js';
import migrationsRoutes from './routes/migrations.js';
import snapshotsRoutes from './routes/snapshots.js';
import branchesRoutes from './routes/branches.js';
import importRoutes from './routes/import.js';
import compareRoutes from './routes/compare.js';

// Import meta migration
import { migrateMetaDb } from '../../cli/src/utils/meta-migration.js';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_NAME = process.env.PROJECT_NAME;
const PROJECT_PATH = process.env.PROJECT_PATH;
const PORT = parseInt(process.env.PORT || '3000');
const IMPORT_MODE = process.env.IMPORT_MODE === 'true';

if (!IMPORT_MODE && (!PROJECT_NAME || !PROJECT_PATH)) {
  console.error('Missing required environment variables: PROJECT_NAME, PROJECT_PATH');
  console.error('Or set IMPORT_MODE=true to run in import-only mode');
  process.exit(1);
}

// Run meta database migration before starting server (skip in import mode)
if (!IMPORT_MODE) {
  const metaDbPath = join(PROJECT_PATH, '.studio', 'meta.db');
  try {
    migrateMetaDb(metaDbPath);
  } catch (error) {
    console.error('Failed to migrate meta database:', error);
    process.exit(1);
  }
}

const fastify = Fastify({
  logger: {
    level: 'info'
  }
});

// CORS - Restrict to localhost origins only for security
// This prevents CSRF-style attacks from malicious websites
// Uses a function to allow any localhost port dynamically
await fastify.register(cors, {
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow any localhost or 127.0.0.1 origin (any port)
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (localhostPattern.test(origin)) {
      return callback(null, true);
    }
    
    // Block all other origins
    return callback(new Error('CORS not allowed'), false);
  }
});

// Store project info in fastify instance (if not in import mode)
if (!IMPORT_MODE) {
  fastify.decorate('projectName', PROJECT_NAME);
  fastify.decorate('projectPath', PROJECT_PATH);
  fastify.decorate('getUserDb', () => getUserDb(PROJECT_PATH));
  fastify.decorate('getMetaDb', () => getMetaDb(PROJECT_PATH));
  fastify.decorate('getCurrentBranch', () => getCurrentBranch(PROJECT_PATH));
}

// API Routes
fastify.register(importRoutes, { prefix: '/api/import' });

// Project-specific routes (only in project mode)
if (!IMPORT_MODE) {
  fastify.register(branchesRoutes, { prefix: '/api/branches' });
  fastify.register(tablesRoutes, { prefix: '/api/tables' });
  fastify.register(queryRoutes, { prefix: '/api/query' });
  fastify.register(schemaRoutes, { prefix: '/api/schema' });
  fastify.register(timelineRoutes, { prefix: '/api/timeline' });
  fastify.register(migrationsRoutes, { prefix: '/api/migrations' });
  fastify.register(snapshotsRoutes, { prefix: '/api/snapshots' });
  fastify.register(compareRoutes, { prefix: '/api/compare' });
}

// Project info endpoint (only in project mode)
if (!IMPORT_MODE) {
  fastify.get('/api/project', async (request, reply) => {
    const configPath = join(PROJECT_PATH, 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const currentBranch = getCurrentBranch(PROJECT_PATH);

    return {
      name: PROJECT_NAME,
      path: PROJECT_PATH,
      port: PORT,
      currentBranch,
      ...config
    };
  });
} else {
  // Import mode - minimal project info
  fastify.get('/api/project', async (request, reply) => {
    return {
      name: 'Import Mode',
      mode: 'import',
      port: PORT
    };
  });
}

// Serve Studio static files
const studioPath = join(__dirname, '../../studio/out');

console.log('Looking for Studio at:', studioPath);
console.log('Studio exists:', existsSync(studioPath));

if (!existsSync(studioPath)) {
  console.error('\n❌ ERROR: Studio build not found!');
  console.error('Please run: cd packages/studio && npm run build\n');
  process.exit(1);
}

await fastify.register(fastifyStatic, {
  root: studioPath,
  prefix: '/',
  decorateReply: false,
  index: 'index.html'
});

// Fallback to index.html for client-side routing
fastify.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith('/api')) {
    reply.code(404).send({ error: 'API endpoint not found' });
  } else {
    reply.sendFile('index.html');
  }
});

// Graceful shutdown
const closeGracefully = async (signal) => {
  console.log(`\nReceived ${signal}, closing gracefully...`);

  try {
    // Close database connections
    const userDb = getUserDb(PROJECT_PATH);
    const metaDb = getMetaDb(PROJECT_PATH);
    userDb.close();
    metaDb.close();

    // Remove server info file
    const serverInfoPath = join(PROJECT_PATH, '.studio', 'server.json');
    if (existsSync(serverInfoPath)) {
      unlinkSync(serverInfoPath);
    }
  } catch (e) {
    console.error('Error during shutdown:', e);
  }

  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', closeGracefully);
process.on('SIGINT', closeGracefully);

// Start server
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n✓ Server started for project "${PROJECT_NAME}"`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Path: ${PROJECT_PATH}\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}