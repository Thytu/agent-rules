# Tech stack

The product's locked decisions. This file wins stack conflicts.

## Platform

| Concern | Choice | Exact pin or source |
|---|---|---|
| Runtime | `REPLACE_ME` | |
| Persistence | `REPLACE_ME` | |
| Object storage | `REPLACE_ME` | |
| Jobs | `REPLACE_ME` | |
| Authentication | `REPLACE_ME` | |
| Product tests | `REPLACE_ME` | |

Selected language contracts live under `docs/profiles/`. Dependency and tool versions are exact; application dependencies resolve from committed lockfiles.

## Ports

Only behavior that truly differs between local and production gets a typed port with both adapters. Everything else remains direct.

| Port | Production adapter | Local/test adapter |
|---|---|---|
| `REPLACE_ME` | | |

External calls have explicit timeouts. Mutations authenticate and authorize at the mutation boundary. File-based ownership avoids shared registries when parallel work is expected.

## Local isolation

Every concurrent worktree has unique ports, cwd-local state, and no shared mutable service binding. Resetting one instance cannot affect another.

## Rejected choices

| Rejected | Use instead | Reason |
|---|---|---|
| `REPLACE_ME` | | |
