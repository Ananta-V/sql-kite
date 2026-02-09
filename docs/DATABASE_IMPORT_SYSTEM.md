# Database Import System

## Design Philosophy

**Golden Rule**: Every database opened by LocalDB must become a managed project.

We don't just "open SQLite files" — we **adopt them into a safe, versioned workspace**.

## Entry Points

There are only two valid ways a database enters the system:

1. **`localdb new <name>`** — Creates a fresh managed project
2. **`localdb import <path>`** — Imports an existing SQLite DB into a managed project

After import, both are treated **identically**. This ensures consistency and prevents corruption.

---

## What Makes a "Managed Project"

```
project/
├─ db/
│  ├─ branches/
│  │  ├─ main.db          ← User database
│  │  ├─ dev.db
│  │  └─ feature-x.db
│  └─ snapshots/
│     └─ *.snapshot.db
├─ migrations/
│  └─ *.sql
└─ .localdb/
   ├─ meta.db             ← Tool metadata ONLY
   ├─ project.json
   └─ locks/
```

**Key principles:**
- Never mix metadata into user DB
- Never run against arbitrary file paths  
- Metadata and user data are always separate

This prevents 80% of corruption problems.

---

## Import Flow (Step by Step)

### CLI Command
```bash
localdb import ./existing/diary.db
```

### Step 1: Preflight Checks (MANDATORY)

Before touching anything:

✅ Check file exists  
✅ Check file extension is `.db`, `.sqlite`, or `.sqlite3` (warn, don't block)  
✅ Check file is readable  
❌ Reject directories  
❌ Reject symlinks (security)  

If any fail → abort with clear error.

### Step 2: Read-Only Probe (CRITICAL)

Open the DB in **read-only mode** first:

```sql
SELECT name FROM sqlite_master LIMIT 1;
PRAGMA user_version;
PRAGMA journal_mode;
```

**Why?**
- Confirms it's a real SQLite DB
- No WAL writes
- No side effects

If this fails → **"This file is not a valid SQLite database."**

### Step 3: Project Import Wizard (UX)

Switch from CLI → Studio. Show a wizard:

```
┌─────────────────────────────────────────┐
│  Import SQLite Database                 │
├─────────────────────────────────────────┤
│                                         │
│  Source: ✓ /path/to/diary.db           │
│                                         │
│  Project name: [diary____________]      │
│                                         │
│  Import mode:                           │
│    (●) Copy into project (recommended)  │
│    ( ) Link original file (advanced)    │
│                                         │
│  ⚠ Original file will NOT be modified   │
│                                         │
│         [Cancel]  [Import Database]     │
└─────────────────────────────────────────┘
```

**Default MUST be Copy.**  
Linking is dangerous and advanced.

### Step 4: Copy Safely (This Matters)

If Copy mode:

1. Close read-only handle
2. Ensure WAL checkpoint:
   ```sql
   PRAGMA wal_checkpoint(FULL);
   ```
3. Copy all files:
   - `diary.db`
   - `diary.db-wal` (if exists)
   - `diary.db-shm` (if exists)
4. Rename → `db/branches/main.db`

This guarantees consistency.

### Step 5: Initialize Metadata (Separate DB)

Create `.localdb/meta.db` with tables:
- `projects`
- `branches`
- `migrations`
- `events`
- `snapshots`

**Never touch the user DB here.**

### Step 6: Baseline Snapshot (IMPORTANT)

Immediately create:

```
snapshots/
└─ imported-baseline.snapshot.db
```

Timeline entry:
```
snapshot → imported-baseline @ 2026-02-07T...
```

This gives:
- Rollback safety
- Trust
- Confidence

### Step 7: Migration Reconciliation (Subtle)

**Key question:** "This DB already has schema. What about migrations?"

**Correct behavior:**  
You DO NOT auto-generate migrations.

Instead, create a **baseline migration marker** (NOT a SQL file):

```sql
-- In meta.db
INSERT INTO migrations (name, checksum, applied_at) 
VALUES ('baseline', 'imported', datetime('now'));
```

**Meaning:** "This schema is the starting truth."

From now on:
- All schema changes must go through migrations
- No retroactive guessing

This avoids lies.

### Step 8: Locking & Concurrency Safety

Create a lock file:
```
.localdb/locks/main.lock
```

- One server per project
- Prevents double-start
- Prevents corruption

If already running:
```
⚠ Project already running
  URL: http://localhost:3000
```

### Step 9: Start Server & Open Studio

Now it feels identical to:
```bash
localdb new diary
localdb start diary
```

Same UI, same sidebar, same migrations, same branches, same snapshots.

**User cannot tell the difference** — and that's the goal.

---

## Security & Safety Guarantees

| Problem | How We Prevent It |
|---------|-------------------|
| **Accidental writes** | Read-only probe first, copy before mutate |
| **Schema pollution** | Metadata never touches user DB |
| **Conflicts** | Branch isolation, WAL handled properly |
| **Double-start** | Lock files |
| **Data loss** | Baseline snapshot |

---

## User Experience

From the user's POV:

> "I opened my old SQLite DB and suddenly it feels like Supabase — but local."

That's the magic.

---

## Edge Cases (Already Solved by Design)

| Problem | Why It Won't Happen |
|---------|---------------------|
| "My DB broke" | Copy + snapshot |
| "Where did my schema come from?" | Baseline marker |
| "Migrations out of sync" | Branch-aware |
| "Two servers wrote at once" | Locks |
| "I deleted the wrong thing" | Snapshots |

---

## Implementation Status

### ✅ Phase 1: CLI Validation (Complete)
- [x] Preflight checks
- [x] Read-only probe
- [x] File validation
- [x] Error messages

### 🚧 Phase 2: Import Wizard UI (In Progress)
- [ ] Modal component
- [ ] Project name input
- [ ] Import mode selection
- [ ] Progress indicator

### ⏳ Phase 3: Backend Import (Pending)
- [ ] Safe DB copy with WAL checkpoint
- [ ] Baseline snapshot creation
- [ ] Migration marker
- [ ] Lock file creation

### ⏳ Phase 4: Integration (Pending)
- [ ] Auto-launch Studio after import
- [ ] Seamless project start
- [ ] Timeline integration

---

## Positioning Statement

> **"We don't just open SQLite files. We adopt them into a safe, versioned workspace."**

This is a real product statement that differentiates LocalDB from simple database viewers.
