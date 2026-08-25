# Lifecycle and capacity

## Review scope

Apply this owner when changed production code creates, retains, retries, or detaches asynchronous work or resources; owns an external operation; queues workload; or retains a collection beyond one operation. Repository evidence must show that this layer owns the lifecycle or capacity decision. A normally awaited database operation inside an existing request lifecycle inherits that caller's lifetime and does not require a second local deadline; a transient result array may naturally match bounded input size. However, a changed catch that converts a rejected external or persistent operation into an ordinary empty/default result owns and hides the terminal failure, so it is in scope. Synchronous helpers, type declarations, tests, comments, and functions that return an operation's result plus its cancellation handle are outside this owner. Propagating a rejection observes a failure; it is not a swallowed outcome.

## Requirements

Every background task, subprocess, stream, subscription, and external resource has an owner, cancellation path, and observed terminal result. Desired and observed external state remain separate; recovery reconciles provider truth. Never hold a synchronous lock across an await.

Queues, retained history, uploads, retries, and concurrency have explicit bounds and capacity behavior. External calls have deadlines and explicit failure outcomes when this layer owns the operation deadline. Retry only work proven idempotent, and keep all attempts inside one operation deadline.

Each concurrent worktree has unique ports and cwd-local state. Reset affects only that worktree. Preview resources remain separate from production and never use production names.
