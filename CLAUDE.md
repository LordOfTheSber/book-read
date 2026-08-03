# CLAUDE.md

Guidance for Claude Code (claude.com/code) when working in this repository.

## Current state of the repository

**This repository is empty.** As of the latest commit it contains exactly two
files: `README.md` (a single heading line) and this file. There is:

- no application or library source code
- no dependency manifest (`package.json`, `pyproject.toml`, `go.mod`, …)
- no build, lint, format, or test configuration
- no CI workflows (`.github/workflows/`)
- a single commit, `34a5647 Initial commit`, on both `main` and any feature branch

Everything below the next heading is therefore *procedure*, not description.
Do not infer a stack, a framework, or a directory layout from the repository
name — nothing here establishes one.

## Before assuming anything

Verify the current state rather than trusting this file, which may lag behind:

```bash
git log --oneline -5
git ls-files
```

If `git ls-files` still returns only `README.md` and `CLAUDE.md`, the repository
is still a blank slate and the notes above hold.

## When the first real code lands

The first substantive change should establish the conventions, and this file
should be rewritten in the same change to describe them. At minimum, replace
this scaffold with:

- **Stack and entry points** — language, runtime version, and the file(s) a
  reader should open first.
- **Layout** — what lives in which directory, and why.
- **Commands** — the exact invocations for install, run, test, lint, and build.
  Prefer copy-pasteable commands over prose. Include how to run a *single* test,
  which is what gets used most during iteration.
- **Conventions** — anything non-obvious that a reviewer would flag: naming,
  error handling, module boundaries, patterns that are deliberate rather than
  accidental.
- **Gotchas** — required environment variables, external services, setup steps
  that fail silently if skipped.

Leave out anything a competent reader would infer from the code itself.

## Git workflow

- `main` is the default branch.
- Work on a feature branch; do not commit directly to `main`.
- Push with `git push -u origin <branch-name>`.
- Open a pull request only when explicitly asked.

## Maintaining this file

Treat `CLAUDE.md` as part of the change, not as follow-up work: when a change
adds a command, moves a directory, or introduces a convention, update the
relevant section in the same commit. A stale entry here is worse than a missing
one, because it is trusted.
