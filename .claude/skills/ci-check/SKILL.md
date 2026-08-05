---
name: ci-check
description: Run this repo's full verification gate (typecheck + tests) locally before committing or opening a PR. Use whenever you're about to hand off a change, not just when asked to "run CI".
---

# ci-check

This mirrors exactly what `.github/workflows/ci.yml` runs on every push and
pull request against `main`. Passing locally means the PR check will pass.

```bash
npm run typecheck
npm test
```

Both must exit 0. If either fails, fix the underlying issue — don't skip
the check or weaken it to make it pass.

Note: edits under `src/**` or `tests/**` already trigger this automatically
via the `PostToolUse` hook in `.claude/settings.json`. Run it manually here
for a final check before a commit/PR that touches other files too (docs,
config, `public/**`), or to double-check after several edits.
