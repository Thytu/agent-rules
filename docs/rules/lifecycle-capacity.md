# Lifecycle and capacity

Every background task, subprocess, stream, subscription, and external resource has an owner, cancellation path, and observed terminal result. Desired and observed external state remain separate; recovery reconciles provider truth. Never hold a synchronous lock across an await.

Queues, retained history, uploads, retries, and concurrency have explicit bounds and capacity behavior. External calls have deadlines and explicit failure outcomes. Retry only work proven idempotent, and keep all attempts inside one operation deadline.

Each concurrent worktree has unique ports and cwd-local state. Reset affects only that worktree. Preview resources remain separate from production and never use production names.
