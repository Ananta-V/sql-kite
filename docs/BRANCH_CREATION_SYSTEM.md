# Branch Creation System

## Core Design Philosophy

> **Every branch must be created from an existing branch.**
> 
> No exceptions. No empty databases. No undefined states.

## Why This Matters

A branch in LocalDB is not an empty database. It's a **stateful snapshot of an existing database**.

This design ensures:
- ✅ Defined schema at all times
- ✅ Predictable migrations
- ✅ Traceable history
- ✅ Safe diffs and comparisons
- ✅ Mental model clarity

## Branch Creation Flow

### User Experience

When a user clicks **"+ Create Branch"**, they see a modal with:

#### Required Fields

1. **Branch Name**
   - Required field
   - Validated format: `[a-zA-Z0-9_/-]+`
   - Auto-validates on input
   - Examples: `feature/auth`, `experiment`, `dev/v2`

2. **Base Branch** 
   - Dropdown selector
   - Default: **current branch**
   - Options: all existing branches
   - Shows current branch indicator

3. **Description** (optional)
   - Free text
   - Helps document branch purpose

### Example UI

```
Create New Branch

Branch name:
[ feature-auth        ]

Base branch:
[ main ▼ ]

Description (optional):
[ Authentication system experiments ]

ℹ️ This will create a full isolated copy of `main`

[Cancel]  [Create Branch]
```

## Internal Implementation

### What Happens When Creating a Branch

1. **Validation**
   - Check branch name format
   - Verify base branch exists
   - Ensure no name collision
   - Validate user input

2. **WAL Checkpoint**
   ```javascript
   sourceDb.pragma('wal_checkpoint(TRUNCATE)')
   ```
   - Freezes base branch state
   - Ensures clean snapshot point
   - Prevents partial writes

3. **Database Copy**
   - Copy main `.db.sqlite` file
   - Copy WAL files if present
   - Copy SHM files if present
   - Full file-level snapshot

4. **Metadata Registration**
   ```sql
   INSERT INTO branches (name, db_file, created_from, description)
   VALUES (?, ?, ?, ?)
   ```
   - Track branch lineage
   - Store creation timestamp
   - Link to base branch

5. **Automatic Snapshot**
   - Create implicit snapshot
   - Store in `.studio/snapshots/`
   - Enable restore capability
   - Format: `{branch}-creation-{timestamp}.snapshot.db`

6. **Timeline Events**
   
   Two events are logged for full traceability:
   
   **In the new branch:**
   ```json
   {
     "type": "branch_created",
     "data": {
       "base_branch": "main",
       "created_at": "2026-02-07T..."
     }
   }
   ```
   
   **In the base branch:**
   ```json
   {
     "type": "branch_created_from_here",
     "data": {
       "new_branch": "feature-auth",
       "created_at": "2026-02-07T..."
     }
   }
   ```

## Integration with Other Systems

### Migrations

```
main
 └─ dev
     └─ feature-x
```

- Migrations in `feature-x` stay isolated
- `dev` remains untouched
- `main` is protected
- Each branch tracks its own migration history
- Promote branches to merge migrations cleanly

### Snapshots

- Snapshots are **per-branch**
- Branch creation = automatic snapshot
- Snapshots can restore **within a branch**
- Base branch is never mutated by child snapshots

### Timeline

- Shows branch creation events
- Displays branch lineage
- Tracks branch switching
- Full audit trail

## Edge Cases & Protections

### Implemented Safeguards

1. **Prevent Name Collision**
   ```javascript
   if (existingBranch) {
     return reply.code(400).send({ error: 'Branch already exists' })
   }
   ```

2. **Prevent Deleting Main**
   ```javascript
   if (name === 'main') {
     return reply.code(400).send({ error: 'Cannot delete main branch' })
   }
   ```

3. **Prevent Deleting Active Branch**
   ```javascript
   if (name === currentBranch) {
     return reply.code(400).send({
       error: 'Cannot delete current branch. Switch to another branch first.'
     })
   }
   ```

4. **Require Base Branch**
   ```javascript
   if (!baseBranch) {
     return reply.code(400).send({
       error: 'Base branch is required. Every branch must be created from an existing branch.'
     })
   }
   ```

5. **Validate Base Branch Exists**
   ```javascript
   if (!sourceInfo) {
     return reply.code(404).send({ error: `Base branch "${baseBranch}" not found` })
   }
   ```

## API Specification

### Create Branch Endpoint

```
POST /api/branches/create
```

**Request Body:**
```json
{
  "name": "feature-auth",
  "baseBranch": "main",
  "description": "Authentication system" // optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "branch": {
    "name": "feature-auth",
    "db_file": "feature-auth.db.sqlite",
    "created_from": "main",
    "created_at": "2026-02-07T10:30:00.000Z",
    "snapshot_created": true
  }
}
```

**Error Responses:**
- `400` - Invalid branch name format
- `400` - Branch already exists
- `400` - Base branch is required
- `404` - Base branch not found
- `500` - Internal error (with details)

## File Structure

```
~/.localdb/runtime/myproject/
├── .studio/
│   ├── meta.db                    # Branch metadata
│   └── snapshots/                 # Auto-created snapshots
│       ├── main-creation-1234.snapshot.db
│       └── feature-auth-creation-5678.snapshot.db
├── db.sqlite                      # Main branch database
├── feature-auth.db.sqlite         # Feature branch database
└── migrations/                    # Migration files (shared)
    └── 001_initial.sql
```

## Best Practices

### Developer Workflow

✅ **DO:**
- Create branches from your current working branch
- Name branches descriptively (`feature/`, `fix/`, `experiment/`)
- Add descriptions for complex branches
- Switch branches before running risky operations

❌ **DON'T:**
- Try to create empty branches (not allowed)
- Delete `main` branch
- Delete your active branch without switching first
- Use special characters in branch names

### Naming Conventions

**Recommended patterns:**
```
main
dev
staging
feature/authentication
feature/api-v2
fix/user-validation
experiment/new-schema
test/performance
backup/pre-migration
```

## Comparison with Git

| Concept | Git | LocalDB |
|---------|-----|---------|
| Branch creation | `git branch dev` | Creates from current |
| Default base | Current branch | Current branch |
| Empty branch | Possible (orphan) | **Not allowed** |
| File copy | Metadata only | Full DB copy |
| Merge strategy | Three-way merge | Promotion/restore |
| Isolation | Same files | Separate DB files |

## Why We Default to Current Branch

This matches developer intuition:

1. You're working on `dev`
2. You want to experiment → `experiment/auth`
3. You expect it to continue from where you are
4. Same mental model as Git, but simpler

**No rebase. No orphans. No confusion.**

## Future Enhancements

Potential improvements:
- [ ] Branch diff visualization
- [ ] Automatic branch cleanup (merged branches)
- [ ] Branch tags/labels
- [ ] Branch permissions
- [ ] Lightweight branches (copy-on-write)
- [ ] Branch templates
- [ ] Branch promotion workflows

## Summary

✅ **Base branch required** - Always  
✅ **Default to current** - Intuitive  
❌ **Never allow empty** - Deterministic  
❌ **No undefined state** - Predictable  

This makes LocalDB:
- **Predictable** - Always know branch state
- **Safe** - Can't create broken states
- **Team-friendly** - Clear lineage
- **Hard to misuse** - Guardrails built-in

---

*Last updated: February 7, 2026*
