# LocalDB Port Management System

## Overview

LocalDB uses a robust, centralized port management system that ensures:

- **No port conflicts** between multiple projects
- **Fast port allocation** with intelligent scanning strategies
- **Automatic cleanup** of stale port allocations
- **Persistent tracking** across CLI sessions
- **Safe concurrent project starts**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Port Management System                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────┐         ┌────────────────┐              │
│  │               │         │                │              │
│  │  Port Finder  │────────▶│ Port Registry  │              │
│  │               │         │                │              │
│  └───────────────┘         └────────────────┘              │
│         │                          │                        │
│         │                          │                        │
│         ▼                          ▼                        │
│  ┌──────────────────────────────────────┐                  │
│  │  ~/.localdb/runtime/.port-registry.json │              │
│  └──────────────────────────────────────┘                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Port Registry (`port-registry.js`)

Central registry that tracks all allocated ports across all LocalDB projects.

**Features:**
- Atomic port allocation (prevents race conditions)
- Automatic stale allocation cleanup
- Process validation
- Persistent storage in `~/.localdb/runtime/.port-registry.json`

**Registry Format:**
```json
{
  "ports": {
    "project-name": {
      "port": 3000,
      "allocated_at": 1675432100000,
      "pid": 12345
    }
  },
  "last_cleanup": 1675432100000
}
```

### 2. Port Finder (`port-finder.js`)

Intelligent port scanning with multiple fallback strategies.

**Port Allocation Strategy:**

1. **Check Registry** - Return existing port if project already has one
2. **Try Requested Port** - Attempt user's preferred port first
3. **Batch Scan** - Parallel scan of 10 ports in default range (faster)
4. **Sequential Scan** - Default range (3000-3999)
5. **Fallback Range** - Higher range (4000-4999)
6. **Extended Range** - Emergency range (5000-9999)

**Port Ranges:**
- `3000-3999` - Default range (preferred)
- `4000-4999` - Fallback range
- `5000-9999` - Extended range (when system is very busy)

### 3. CLI Integration

#### Start Command
```bash
localdb start myproject
```
- Finds free port using registry
- Reserves port atomically
- Starts server with allocated port
- Stores port in `server.json`

#### Stop Command
```bash
localdb stop myproject
```
- Gracefully shuts down server
- Releases port from registry
- Removes `server.json`

#### Ports Command
```bash
# View all port allocations
localdb ports

# Clean up stale allocations
localdb ports --cleanup
```

## How It Works

### Starting a Project

```
User: localdb start diary
  │
  ├──▶ Check if already running
  │     - Read ~/.localdb/runtime/diary/.studio/server.json
  │     - If exists, open browser and exit
  │
  ├──▶ Find free port
  │     - Call findFreePort(3000, "diary")
  │     - Auto-cleanup stale allocations first
  │     - Check registry for existing allocation
  │     - Try preferred port (3000)
  │     - Batch scan ports 3000-3010
  │     - Sequential scan 3000-3999
  │     - Fallback to 4000-4999 if needed
  │
  ├──▶ Reserve port atomically
  │     - Verify port is free at OS level
  │     - Write to registry
  │     - Return port (e.g., 3001)
  │
  ├──▶ Spawn server process
  │     - env: PORT=3001, PROJECT_NAME=diary
  │     - detached: true
  │
  └──▶ Write server.json
        - { pid: 12345, port: 3001, started_at: "..." }
```

### Stopping a Project

```
User: localdb stop diary
  │
  ├──▶ Read server.json
  │     - Get pid and port
  │
  ├──▶ Send SIGTERM to process
  │     - Wait up to 5 seconds
  │     - Force kill if needed (SIGKILL)
  │
  ├──▶ Remove server.json
  │
  └──▶ Release port from registry
        - Remove project entry from ports
        - Write updated registry
```

### Auto-Cleanup Process

The registry automatically cleans up stale allocations:

**Triggers:**
- Every time `findFreePort()` is called
- When `localdb ports --cleanup` is run
- Automatically if last cleanup > 1 hour ago

**Cleanup Logic:**
```javascript
For each allocated port:
  1. Check if server.json exists
  2. If not, remove allocation
  3. If yes, check if process is alive
  4. If process dead, remove allocation
```

## Port Conflict Resolution

### Scenario: Port Already in Use

```
Port 3000 requested
  │
  ├──▶ Check OS: Port 3000 in use
  │
  ├──▶ Check next port: 3001
  │
  ├──▶ Check OS: Port 3001 free
  │
  ├──▶ Reserve in registry
  │
  └──▶ Return 3001
```

### Scenario: Registry Out of Sync

```
Registry says port 3000 allocated to "old-project"
  │
  ├──▶ Check server.json for "old-project"
  │
  ├──▶ File doesn't exist
  │
  ├──▶ Remove stale allocation
  │
  ├──▶ Port 3000 now available
  │
  └──▶ Reserve for new project
```

### Scenario: Concurrent Starts

```
Terminal 1: localdb start project-a
Terminal 2: localdb start project-b (same time)

T1: Find port 3000, check OS ✓
T2: Find port 3000, check OS ✓

T1: Reserve in registry (writes first) ✓
T2: Reserve in registry (fails - already taken)

T1: Gets port 3000 ✓
T2: Tries port 3001 ✓
```

## Performance Optimizations

### 1. Batch Scanning
Checks 10 ports in parallel instead of sequentially:
```javascript
// Old: Sequential (slow)
for (port in range) {
  if (await isPortFree(port)) return port;
}

// New: Parallel batch (fast)
const batch = await checkPortsBatch([3000, 3001, 3002, ...]);
return batch.find(p => p.free);
```

**Result:** ~10x faster when system has many allocated ports

### 2. Registry-First Checks
Skips OS-level checks for known allocated ports:
```javascript
// Skip registry allocated ports immediately
if (registryHasPort(port)) continue;

// Only check OS for potential ports
if (await isOSPortFree(port)) return port;
```

**Result:** Avoids expensive OS syscalls

### 3. Project-Specific Allocation
Remembers ports for each project:
```javascript
// Project "diary" always gets same port if available
const existingPort = getProjectPort("diary");
if (existingPort && isPortFree(existingPort)) {
  return existingPort; // No search needed
}
```

**Result:** Instant allocation for restarted projects

## CLI Commands Reference

### View Port Status
```bash
localdb ports
```

Output:
```
📊 LocalDB Port Registry Status

  Total allocations: 3

  Project              Port    Allocated At              PID
  ─────────────────────────────────────────────────────────────
  diary                3000    2/5/2026, 10:30:00 AM     12345
  todo-app             3001    2/5/2026, 10:31:00 AM     12346
  blog                 3002    2/5/2026, 10:32:00 AM     12347

  Last cleanup: 2/5/2026, 10:30:00 AM

  Run with --cleanup to remove stale allocations
```

### Cleanup Stale Allocations
```bash
localdb ports --cleanup
```

Output:
```
Cleaning up stale port allocations...
✓ Cleaned 2 stale allocation(s)
```

## Edge Cases Handled

### 1. Corrupted Registry
- Automatically recreates registry file
- Defaults to empty state

### 2. Dead Process with Allocation
- Auto-cleanup detects dead process
- Frees port for reuse

### 3. Manual Server Kill
- Registry auto-cleanup detects missing server.json
- Frees port on next allocation attempt

### 4. No Available Ports
- Clear error message
- Suggests port range to free up

### 5. Permission Errors
- Falls back to higher port ranges
- Tries alternative ports

### 6. Rapid Start/Stop Cycles
- Port released immediately on stop
- Can restart same project instantly

## Testing

### Test Concurrent Starts
```bash
# Terminal 1
localdb start project-a

# Terminal 2 (simultaneously)
localdb start project-b

# Terminal 3 (simultaneously)
localdb start project-c

# Check allocations
localdb ports
```

Expected: All projects get unique ports, no conflicts.

### Test Port Reclamation
```bash
# Start and get port
localdb start test-project
# Note the port (e.g., 3000)

# Kill process manually (simulates crash)
kill -9 <pid>

# Start again - should get same port
localdb start test-project

# Or run cleanup
localdb ports --cleanup
```

Expected: Stale allocation cleaned, port reused.

### Test Port Range Exhaustion
```bash
# Fill default range
for i in {1..100}; do
  localdb start "project-$i"
done

# Check ports used
localdb ports
```

Expected: Uses fallback ranges (4000+) when 3000-3999 full.

## Security Considerations

### Port Binding
- Binds to `0.0.0.0` for proper OS-level checking
- Server binds to `0.0.0.0` to allow remote access if needed
- Firewall rules should restrict external access if needed

### Process Validation
- Uses `process.kill(pid, 0)` to check if process exists
- Never actually kills processes during validation
- Only SIGTERM/SIGKILL during explicit stop commands

### Registry Locking
- Atomic writes (writeFileSync)
- Clock-based conflict resolution
- No distributed locking needed (single-machine)

## Troubleshooting

### Problem: Port shows allocated but project not running

**Solution:**
```bash
localdb ports --cleanup
```

### Problem: "Port in use" error but localdb ports shows empty

**Solution:**
Another application is using the port. LocalDB will auto-skip to next port.

### Problem: Ports keep incrementing (3000, 3001, 3002...)

**Cause:** Previous allocations not cleaned up.

**Solution:**
```bash
localdb ports --cleanup
# Or restart projects properly with stop command
```

### Problem: Can't find free port

**Solution:**
Free up some ports:
```bash
# Stop unused projects
localdb list
localdb stop <unused-project>

# Or cleanup stale allocations
localdb ports --cleanup
```

## Future Enhancements

Potential improvements for v2:

1. **Web Dashboard** - View port allocations in Studio UI
2. **Custom Port Ranges** - Let users configure preferred ranges
3. **Port Preferences** - Remember user's preferred port per project
4. **Health Checks** - Ping servers to validate they're responding
5. **Port Forwarding** - Built-in ngrok-style tunneling
6. **Cluster Mode** - Multiple servers per project (load balancing)

## Summary

LocalDB's port management system provides:

✅ **Automatic** - No manual port configuration needed
✅ **Fast** - Parallel scanning, registry-first checks
✅ **Reliable** - Auto-cleanup, conflict detection
✅ **Safe** - Atomic allocation, process validation
✅ **Simple** - One command to view/manage all ports

Users never need to think about ports - the system just works.
