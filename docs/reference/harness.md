# Eval-harness & cross-cutting rules

The rules that keep a judged UI survivable by a headless agent (no inbox, limited turns) and hold the cross-cutting product bar.

## Harness survival

- **Never native `confirm()` / `alert()` / `prompt()`** for a destructive or gating action — harnesses auto-accept native dialogs. Use an in-app modal.
- **Copyable invite / magic links in the admin UI** — not email-only. The agent has no inbox.
- **Route aliases + conventional labels** so a judge (or a user) can guess the URL.
- **Close-date / window fields accept the past** if a harness backdates to close something, then reopens it.
- **Identity linking by a stable key** (normalized email, …) so a signup lands in the existing record.

## Cross-cutting product bar

- **Every list has an empty state** that says why it's empty and the next action — including lists inside cards, columns, and menus. A bare `<p>` is none of them.
- **One shared widget** wherever forks would proliferate (rich text, file picker, …). Never a second copy.
- **Public pages are mobile-friendly.** Admin may be desktop-only.
- **Lists show skeletons, never spinners.** Pages target sub-second loads.
- **Optional bot checks no-op when unkeyed**, so a headless agent isn't stuck on a challenge it can't solve.
- **Suppression / unsubscribe applies to bulk / announcements only.** Everything that is a consequence of the recipient's own action is transactional and ALWAYS delivers.
