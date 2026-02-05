import { createServer } from 'net';
import portRegistry from './port-registry.js';

/**
 * Port configuration
 */
const PORT_CONFIG = {
  DEFAULT_START: 3000,
  DEFAULT_END: 3999,
  FALLBACK_START: 4000,
  FALLBACK_END: 4999,
  MAX_ATTEMPTS: 100,
  SCAN_BATCH_SIZE: 10
};

/**
 * Check if a single port is available at OS level
 */
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();

    const cleanup = () => {
      server.removeAllListeners();
    };

    server.once('error', (err) => {
      cleanup();
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close(() => {
        cleanup();
        resolve(true);
      });
    });

    // Bind to all interfaces to ensure we check properly
    server.listen(port, '0.0.0.0');
  });
}

/**
 * Find a free port in the given range
 * Uses intelligent scanning with registry integration
 */
async function findFreePortInRange(startPort, endPort, projectName = null) {
  // Auto-cleanup stale allocations
  portRegistry.autoCleanup();

  // Get currently allocated ports from registry
  const allocatedPorts = portRegistry.getAllocatedPorts();

  let attempts = 0;
  let currentPort = startPort;

  while (currentPort <= endPort && attempts < PORT_CONFIG.MAX_ATTEMPTS) {
    attempts++;

    // Skip ports already allocated in registry
    if (allocatedPorts.includes(currentPort)) {
      currentPort++;
      continue;
    }

    // Check if port is available at OS level
    const available = await isPortAvailable(currentPort);

    if (available) {
      // Try to reserve in registry if project name provided
      if (projectName) {
        const reserved = await portRegistry.reservePort(projectName, currentPort);
        if (reserved) {
          return currentPort;
        }
        // Port was taken by another process between check and reserve
        // Continue to next port
        currentPort++;
        continue;
      }

      return currentPort;
    }

    currentPort++;
  }

  return null;
}

/**
 * Scan multiple ports in parallel (batch scanning)
 * Much faster for finding free ports in busy systems
 */
async function scanPortsBatch(ports) {
  const results = await Promise.all(
    ports.map(async (port) => ({
      port,
      available: await isPortAvailable(port)
    }))
  );

  const availablePort = results.find(r => r.available);
  return availablePort ? availablePort.port : null;
}

/**
 * Find a free port with intelligent strategies
 *
 * Strategy:
 * 1. Check registry for existing project allocation
 * 2. Try default range (3000-3999) with batch scanning
 * 3. Fallback to higher range (4000-4999)
 * 4. Sequential scan as last resort
 *
 * @param {number} startPort - Preferred starting port (default: 3000)
 * @param {string} projectName - Project name for registry tracking (optional)
 * @returns {Promise<number>} - Free port number
 */
export async function findFreePort(startPort = PORT_CONFIG.DEFAULT_START, projectName = null) {
  try {
    // Auto-cleanup stale allocations first
    portRegistry.autoCleanup();

    // If project name provided, check if already has allocated port
    if (projectName) {
      const existingPort = portRegistry.getProjectPort(projectName);
      if (existingPort) {
        // Verify it's still valid
        const isValid = await isPortAvailable(existingPort);
        if (isValid) {
          return existingPort;
        }
        // Port no longer valid, release it
        portRegistry.releasePort(projectName);
      }
    }

    // Strategy 1: Try the requested start port
    if (startPort >= PORT_CONFIG.DEFAULT_START && startPort <= PORT_CONFIG.DEFAULT_END) {
      const allocatedPorts = portRegistry.getAllocatedPorts();
      if (!allocatedPorts.includes(startPort)) {
        const available = await isPortAvailable(startPort);
        if (available) {
          if (projectName) {
            const reserved = await portRegistry.reservePort(projectName, startPort);
            if (reserved) return startPort;
          } else {
            return startPort;
          }
        }
      }
    }

    // Strategy 2: Quick batch scan in default range
    const defaultRangeStart = Math.max(startPort, PORT_CONFIG.DEFAULT_START);
    const batchPorts = [];
    for (let i = 0; i < PORT_CONFIG.SCAN_BATCH_SIZE; i++) {
      const port = defaultRangeStart + i;
      if (port <= PORT_CONFIG.DEFAULT_END) {
        batchPorts.push(port);
      }
    }

    if (batchPorts.length > 0) {
      const allocatedPorts = portRegistry.getAllocatedPorts();
      const freePorts = batchPorts.filter(p => !allocatedPorts.includes(p));

      if (freePorts.length > 0) {
        const batchResult = await scanPortsBatch(freePorts);
        if (batchResult) {
          if (projectName) {
            const reserved = await portRegistry.reservePort(projectName, batchResult);
            if (reserved) return batchResult;
          } else {
            return batchResult;
          }
        }
      }
    }

    // Strategy 3: Sequential scan in default range
    let port = await findFreePortInRange(
      defaultRangeStart,
      PORT_CONFIG.DEFAULT_END,
      projectName
    );
    if (port) return port;

    // Strategy 4: Fallback range
    port = await findFreePortInRange(
      PORT_CONFIG.FALLBACK_START,
      PORT_CONFIG.FALLBACK_END,
      projectName
    );
    if (port) return port;

    // Strategy 5: Extended range (5000-9999)
    port = await findFreePortInRange(5000, 9999, projectName);
    if (port) return port;

    // No port found
    throw new Error(
      'Unable to find a free port. Please ensure you have available ports in range 3000-9999'
    );
  } catch (error) {
    if (error.message.includes('Unable to find')) {
      throw error;
    }
    // Fallback to simple sequential search on unexpected errors
    return findFreePortInRange(startPort, startPort + 1000, projectName);
  }
}

/**
 * Release a port for a project
 */
export function releasePort(projectName) {
  return portRegistry.releasePort(projectName);
}

/**
 * Get port registry status
 */
export function getPortStatus() {
  return portRegistry.getStatus();
}

/**
 * Manual cleanup of stale allocations
 */
export function cleanupStalePorts() {
  return portRegistry.cleanup();
}