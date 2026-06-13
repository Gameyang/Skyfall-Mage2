# Codex Working Rules

- Keep user-facing responses concise.
- When a task changes files, finish the task before replying.
- Before the final reply for a file-changing task, run the relevant verification commands.
- After verification, run `npm run finish -- -Message "<short commit message>"` so changes are staged, committed, and pushed to `origin`.
- Do not create an empty commit when there are no file changes.
- Use the existing `.githooks/post-commit` auto-push hook for manual commits.
