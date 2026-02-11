<p align="center">
  <img src="https://img.shields.io/badge/SQLite-Local--First-blue?style=for-the-badge&logo=sqlite" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Offline-No%20Cloud%20Required-111827?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Zero%20Telemetry-Privacy%20Respecting-10b981?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge" />
</p>

<h1 align="center">SQL Kite</h1>

<p align="center">
  <strong>Version-controlled SQLite for local development.</strong>
</p>init

<p align="center">
  Branch your database. Inspect every change. Recover instantly.<br/>
  <b>No cloud • No accounts • No telemetry</b>
</p>

---

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#security-model">Security</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## What is SQL Kite?

SQL Kite is a **local-first database workspace** that brings Git-style workflows to SQLite.

Instead of treating a `.db` file as a fragile binary blob, SQL Kite turns it into a managed project.

> Think of it as **Git for your SQLite database** — but purpose-built for development workflows.

You can experiment freely because every change is recorded and reversible.

---

## Why this exists

During development, SQLite databases usually turn into this:

```
app.db
app_v2.db
app_new_final.db
app_new_final_real.db
app_new_final_real_fixed.db
```

No history. No reproducibility. No safety.

SQL Kite fixes that.

> Code has Git. Databases should too.

---

## The Idea (in 10 seconds)

Without SQL Kite:

```
schema.sql
app.db
backup.db
backup2.db
backup3.db
```

With SQL Kite:

```
main
 ├── feature/auth-system
 ├── testing/seed-data
 └── experiment/new-schema
```

You stop copying files.
You start managing database environments.

---

<a name="features"></a>

## Features

| Capability     | What it gives you                     |
| -------------- | ------------------------------------- |
| **Branching**  | Isolated DB environments for features |
| **Timeline**   | Full history of SQL operations        |
| **Snapshots**  | Instant recovery points               |
| **Migrations** | Structured schema evolution           |
| **Studio UI**  | Visual database explorer              |
| **Import**     | Adopt any existing SQLite database    |

---

### Database Branching

Create independent database branches instantly.

You can test migrations, destructive queries, or new schemas safely.

---

### Timeline History

Every SQL statement is recorded.

You can inspect **who changed what and when**.

---

### Snapshots & Restore

Before risky operations, create a snapshot.

Restore in seconds.

> You can always go back.

---

### Studio UI

A clean local interface for:

* Browsing tables
* Editing rows
* Running queries
* Comparing branches
* Viewing database events

---

## Screenshots

### SQL Editor

Execute queries, save templates, and export results with full SQL syntax highlighting.

![SQL Editor](../../screenshots/sql-editor.png)

### Database Schema Viewer

Browse tables, inspect columns, constraints, indexes, and relationships in a clean interface.

![Database Schema](../../screenshots/database-schema.png)

---

## Zero-Cloud Architecture

SQL Kite runs **entirely on your machine**.

* No remote servers
* No login
* No tracking
* No telemetry
* No internet required

> Your database never leaves your computer.

---

<a name="installation"></a>

## Installation

### Requirements

* Node.js 18+
* npm

### Install Globally (Recommended)

Install SQL Kite globally to use it from anywhere:

```bash
npm install -g sql-kite
```

After installation, you can use `sql-kite` commands directly:

```bash
sql-kite new my-db
sql-kite start my-db
```

> **Note:** Use global installation (`-g` flag) for CLI tools. After installing globally, run commands directly as `sql-kite <command>`, not `npm run sql-kite <command>`.

---

<a name="quick-start"></a>

## Quick Start

### 1) Create a project

```bash
sql-kite new my-db
```

### 2) Start the studio

```bash
sql-kite start my-db
```

Your browser opens automatically.

---

### Import an existing database

```bash
sql-kite import ./database.db
```

> SQL Kite will safely adopt the file into a managed workspace.

---

## CLI Commands

| Command                    | Description                 |
| ---------------------------| ----------------------------|
| `sql-kite import <path>`   | Import database             |
| `sql-kite start <name>`    | Launch Studio               |
| `sql-kite stop <name>`     | Stop server                 |
| `sql-kite open <name>`     | Open UI                     |
| `sql-kite list`            | List projects               |
| `sql-kite new <name>`      | Create project              |
| `sql-kite delete <name>`   | Remove project              |
| `sql-kite ports`           | Show port usage             |
| `sql-kite init`            | Scaffold app database layer |

---

## App Integration

### For React Native / Expo Apps

SQL Kite provides a database integration layer with automatic dev/production switching.

**1) Scaffold the integration:**

```bash
cd your-app-project
sql-kite init
```

This creates:
```
lib/database/
  ├── index.js
  ├── engine.dev.js
  └── engine.local.js
```

**2) Use in your app:**

```javascript
import { runQuery } from '@/lib/database';

const users = await runQuery("SELECT * FROM users WHERE active = ?", [1]);
```

### Two Workflow Modes

**Development Mode:**
- Queries go to SQL-Kite server via HTTP
- API is locked to `main` branch only
- Switch branches freely in Studio - your app stays isolated
- Configure port via `SQL_KITE_PORT` env variable

**Production Mode:**
- Queries run locally via expo-sqlite
- Export `main.db` from SQL-Kite UI
- Bundle it with your app
- No server required

### Why This Architecture?

**Same code. Different engine.**

```javascript
// This works everywhere
runQuery("SELECT * FROM users")

// Development → HTTP to SQL-Kite
// Production  → Local SQLite
```

Your app never knows:
- That branches exist
- That you're switching between dev/prod
- About SQL-Kite's internal tooling

> Clean separation between development tools and runtime code.

---

## Project Structure

```
~/.sql-kite/runtime/<project>/
```

```
project/
├── db.sqlite
├── config.json
├── migrations/
├── snapshots/
└── .studio/
    ├── meta.db
    ├── server.json
    └── locks/
```

---

<a name="security-model"></a>

## Security Model

SQL Kite is intentionally restrictive.

### Localhost Only

The server binds only to:

```
http://localhost
http://127.0.0.1
```

It is never publicly accessible.

### No Elevated Permissions

Runs with normal user privileges.
No root required.

### Filesystem Protection

* Validates project paths
* Blocks traversal
* Rejects symlinks

### Local Data Storage

All data lives inside:

```
~/.sql-kite/
```

> SQL Kite cannot access anything outside its workspace.

---

## Development

Run services individually:

```bash
npm run dev:cli
npm run dev:server
npm run dev:studio
```

Build UI:

```bash
npm run build:studio
```

---

<a name="architecture"></a>

## Architecture

| Package | Tech                | Purpose   |
| ------- | ------------------- | --------- |
| cli     | Node.js + Commander | CLI       |
| server  | Fastify             | Local API |
| studio  | Next.js + React     | UI        |

### Tech Stack

* SQLite (better-sqlite3)
* Fastify
* Next.js
* React
* Tailwind CSS
* Monaco Editor

---

## Troubleshooting

### Port in use

```bash
sql-kite ports
```

### Restart project

```bash
sql-kite stop my-db
sql-kite start my-db
```

### Import fails

Check:

* Valid SQLite file
* Read permissions
* Not a symlink

---

## Contributing

PRs welcome.

1. Fork
2. Branch
3. Commit
4. Pull Request

---

## License

MIT

---

## Author

**D Krishna**
https://github.com/Ananta-V

---

<p align="center">
  Built for developers who prefer tools they can trust.
</p>
