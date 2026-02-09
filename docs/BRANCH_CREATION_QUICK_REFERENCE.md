# Branch Creation - Quick Reference

## ✅ The Golden Rule

> **Every branch MUST be created from an existing branch.**  
> No exceptions. No empty databases. Period.

---

## 🎯 Quick Start

### Creating a Branch (UI)

1. Click **"+ Create Branch"** in Studio
2. Enter branch name (e.g., `feature/auth`)
3. Select base branch (defaults to current)
4. Optionally add description
5. Click **"Create Branch"**

**Result:**
- ✅ Full copy of base branch database
- ✅ Automatic snapshot created
- ✅ Timeline events logged (both branches)
- ✅ Ready to use immediately

### Creating a Branch (API)

```javascript
POST /api/branches/create

{
  "name": "feature/auth",
  "baseBranch": "main",          // REQUIRED
  "description": "Auth system"   // optional
}
```

---

## 📋 Validation Rules

### Branch Name Format
- ✅ Letters: `a-z`, `A-Z`
- ✅ Numbers: `0-9`
- ✅ Special: `-`, `_`, `/`
- ❌ Spaces, special chars

**Examples:**
```
✅ main
✅ dev
✅ feature/authentication
✅ fix/user-validation
✅ experiment_v2
✅ backup-2026-02-07

❌ my branch
❌ feature@auth
❌ test!123
```

### Required Fields
- ✅ `name` - Branch name
- ✅ `baseBranch` - Source branch
- ⚪ `description` - Optional

---

## 🛡️ Protections

| Protection | Error | Resolution |
|------------|-------|------------|
| Name already exists | `Branch already exists` | Choose different name |
| No base branch | `Base branch is required` | Select base branch |
| Base not found | `Base branch not found` | Use existing branch |
| Delete main | `Cannot delete main` | Protected |
| Delete active | `Cannot delete current` | Switch first |

---

## 📊 What Happens Internally

```
1. Validate inputs ───────────────────┐
2. Check base branch exists ──────────┤
3. WAL checkpoint (freeze state) ─────┤─ Safety Checks
4. Copy DB files ─────────────────────┤
5. Create automatic snapshot ─────────┤
6. Register metadata ─────────────────┤─ Tracking
7. Log timeline events (×2) ──────────┤
8. Return success ────────────────────┘
```

---

## 🔍 Timeline Events

### When you create `feature/auth` from `main`:

**In `main` branch:**
```json
{
  "type": "branch_created_from_here",
  "data": {
    "new_branch": "feature/auth",
    "created_at": "2026-02-07T..."
  }
}
```

**In `feature/auth` branch:**
```json
{
  "type": "branch_created",
  "data": {
    "base_branch": "main",
    "created_at": "2026-02-07T..."
  }
}
```

---

## 📁 File Structure

```
~/.localdb/runtime/myproject/
├── .studio/
│   ├── meta.db                          # Metadata
│   └── snapshots/
│       ├── main-creation-1234.db        # Auto-snapshot
│       └── feature-auth-creation-5678.db
├── db.sqlite                            # main branch
├── dev.db.sqlite                        # dev branch
├── feature-auth.db.sqlite               # feature branch
└── migrations/
    └── 001_initial.sql
```

---

## 🎨 Best Practices

### ✅ DO

- Create branches from current working branch (default)
- Use descriptive names with prefixes
- Add descriptions for complex branches
- Switch before deleting a branch

### ❌ DON'T

- Try to create empty branches (not possible)
- Delete `main` branch (protected)
- Delete active branch (switch first)
- Use spaces or special characters

---

## 🌳 Branch Hierarchies

### Example 1: Development Flow
```
main
 ├── staging
 └── dev
      ├── feature/auth
      ├── feature/api-v2
      └── fix/validation
```

### Example 2: Experimentation
```
main
 └── experiment/new-schema
      ├── experiment/new-schema-v1
      └── experiment/new-schema-v2
```

### Example 3: Safe Testing
```
main
 ├── backup/before-migration
 └── test/performance
```

---

## 🔄 Common Workflows

### Safe Experimentation
```
1. On 'main' branch
2. Create 'experiment/schema' (base: main)
3. Run experiments in new branch
4. If successful → promote/merge to main
5. If failed → delete experiment branch
```

### Feature Development
```
1. On 'dev' branch
2. Create 'feature/auth' (base: dev)
3. Develop feature
4. Test in isolation
5. When ready → merge back to dev
```

### Backup Before Migration
```
1. On 'main' branch
2. Create 'backup/pre-migration' (base: main)
3. Switch back to 'main'
4. Run migration
5. Keep backup for rollback
```

---

## ⚡ Quick Commands

### Via Studio (UI)
```
1. "+ Create Branch" button
2. Fill form
3. Click "Create Branch"
```

### Via API
```javascript
// Create from current branch
await createBranch('feature/auth', currentBranch)

// Create from specific branch
await createBranch('experiment', 'main', 'Testing new schema')
```

---

## 🚨 Troubleshooting

**Error: "Branch already exists"**
- Choose a different name
- Or delete the existing branch first

**Error: "Base branch is required"**
- This is a system requirement
- Select any existing branch as base

**Error: "Cannot delete current branch"**
- Switch to a different branch first
- Then delete

**Error: "Cannot delete main branch"**
- `main` is protected
- Create a new branch from main instead

---

## 💡 Pro Tips

1. **Default is smart** - Defaults to current branch (most common use case)
2. **Snapshots are free** - Automatic snapshot on creation (no cost)
3. **Timeline is truth** - Check timeline to see branch lineage
4. **Isolation is complete** - Branches are fully isolated DB files
5. **Main is sacred** - Can't delete main branch (by design)

---

## 📚 See Also

- [BRANCH_CREATION_SYSTEM.md](./BRANCH_CREATION_SYSTEM.md) - Full documentation
- [BRANCH_CREATION_IMPLEMENTATION.md](./BRANCH_CREATION_IMPLEMENTATION.md) - Technical details
- [BRANCH_SYSTEM_IMPLEMENTATION.md](./BRANCH_SYSTEM_IMPLEMENTATION.md) - Overall branch system

---

*Quick Reference v1.0 - February 7, 2026*
