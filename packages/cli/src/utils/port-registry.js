import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { RUNTIME_DIR } from './paths.js';
import { createServer } from 'net';

const REGISTRY_FILE = join(RUNTIME_DIR, '.port-registry.json');
const LOCK_TIMEOUT = 5000; // 5 seconds

/**
 * Port Registry - Manages port allocation across all LocalDB projects
 *
 * Features:
 * - Centralized port tracking
 * - Atomic port allocation
 * - Conflict detection
 * - Automatic cleanup of stale allocations
 * - Fast port validation
 */

class PortRegistry {
  constructor() {
    this.ensureRegistryFile();
  }

  ensureRegistryFile() {
    if (!existsSync(RUNTIME_DIR)) {
      mkdirSync(RUNTIME_DIR, { recursive: true });
    }
    if (!existsSync(REGISTRY_FILE)) {
      this.writeRegistry({ ports: {}, last_cleanup: Date.now() });
    }
  }

  readRegistry() {
    try {
      const data = readFileSync(REGISTRY_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      // Corrupted registry, recreate
      this.writeRegistry({ ports: {}, last_cleanup: Date.now() });
      return { ports: {}, last_cleanup: Date.now() };
    }
  }

  writeRegistry(data) {
    writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2));
  }

  /**
   * Get all currently allocated ports
   */
  getAllocatedPorts() {
    const registry = this.readRegistry();
    return Object.values(registry.ports).map(entry => entry.port);
  }

  /**
   * Check if a port is allocated to any project
   */
  isPortAllocated(port) {
    const allocatedPorts = this.getAllocatedPorts();
    return allocatedPorts.includes(port);
  }

  /**
   * Get port for a specific project
   */
  getProjectPort(projectName) {
    const registry = this.readRegistry();
    return registry.ports[projectName]?.port || null;
  }

  /**
   * Reserve a port for a project atomically
   */
  async reservePort(projectName, port) {
    const registry = this.readRegistry();

    // Check if project already has a port
    if (registry.ports[projectName]) {
      const existingPort = registry.ports[projectName].port;
      // Verify the existing port is still valid
      const isValid = await this.isPortActuallyFree(existingPort);
      if (isValid) {
        return existingPort;
      }
      // Stale allocation, remove it
      delete registry.ports[projectName];
    }

    // Check if port is already allocated
    const allocatedPorts = Object.values(registry.ports).map(e => e.port);
    if (allocatedPorts.includes(port)) {
      return null; // Port already taken
    }

    // Verify port is actually free at OS level
    const isFree = await this.isPortActuallyFree(port);
    if (!isFree) {
      return null;
    }

    // Reserve the port
    registry.ports[projectName] = {
      port,
      allocated_at: Date.now(),
      pid: process.pid
    };

    this.writeRegistry(registry);
    return port;
  }

  /**
   * Release a port for a project
   */
  releasePort(projectName) {
    const registry = this.readRegistry();
    if (registry.ports[projectName]) {
      delete registry.ports[projectName];
      this.writeRegistry(registry);
      return true;
    }
    return false;
  }

  /**
   * Check if a port is actually free at OS level
   */
  async isPortActuallyFree(port) {
    return new Promise((resolve) => {
      const server = createServer();

      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, '0.0.0.0');
    });
  }

  /**
   * Cleanup stale port allocations
   * Checks if server.json files exist for allocated projects
   */
  cleanup() {
    const registry = this.readRegistry();
    const projects = Object.keys(registry.ports);
    let cleanedCount = 0;

    for (const projectName of projects) {
      const serverInfoPath = join(RUNTIME_DIR, projectName, '.studio', 'server.json');

      // If server.json doesn't exist, the port allocation is stale
      if (!existsSync(serverInfoPath)) {
        delete registry.ports[projectName];
        cleanedCount++;
      } else {
        // Verify the server is actually running
        try {
          const serverInfo = JSON.parse(readFileSync(serverInfoPath, 'utf-8'));
          try {
            // Check if process exists (signal 0 doesn't kill, just checks)
            process.kill(serverInfo.pid, 0);
          } catch (e) {
            // Process doesn't exist, cleanup
            delete registry.ports[projectName];
            unlinkSync(serverInfoPath);
            cleanedCount++;
          }
        } catch (e) {
          // Corrupted server.json
          delete registry.ports[projectName];
          cleanedCount++;
        }
      }
    }

    registry.last_cleanup = Date.now();
    this.writeRegistry(registry);

    return cleanedCount;
  }

  /**
   * Auto cleanup if last cleanup was more than 1 hour ago
   */
  autoCleanup() {
    const registry = this.readRegistry();
    const ONE_HOUR = 60 * 60 * 1000;

    if (!registry.last_cleanup || (Date.now() - registry.last_cleanup) > ONE_HOUR) {
      return this.cleanup();
    }

    return 0;
  }

  /**
   * Get registry status
   */
  getStatus() {
    const registry = this.readRegistry();
    return {
      total_allocations: Object.keys(registry.ports).length,
      allocations: registry.ports,
      last_cleanup: registry.last_cleanup
    };
  }

  /**
   * Force clear all allocations (dangerous - for debugging only)
   */
  clearAll() {
    this.writeRegistry({ ports: {}, last_cleanup: Date.now() });
  }
}

// Singleton instance
const portRegistry = new PortRegistry();

export default portRegistry;
export { PortRegistry };
