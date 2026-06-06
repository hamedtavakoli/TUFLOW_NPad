# AGENTS.md

Always read this file first when working in this repository.

## Project

TUFLOW Command Studio is a static React/Vite/TypeScript browser app for editing and reviewing TUFLOW control files and related project text files. It uses CodeMirror 6, TUFLOW command metadata, project file indexing, diagnostics, and compare tools.

The app is client-side only. Files are opened through browser file APIs and saved by download unless the user explicitly requests a different persistence model.

## Must-Read Project Memory

- `docs/AI_RULES.md`: permanent coding, UI, TUFLOW, testing, versioning, and safe-change rules.
- `docs/AI_CONTEXT.md`: durable project purpose, architecture, stack, data sources, and implemented workflows.
- `docs/SESSION_HANDOVER.md`: current development state, known limitations, risks, and recent verification notes.
- `docs/PROJECT_ROADMAP.md`: prioritized next work and future ideas.

Use these files as project memory. Keep `AGENTS.md` concise and operational.

## Core Rules

- Do not invent features. Clearly distinguish implemented behavior from proposed work.
- Preserve the browser-only persistence model: Save means download.
- Keep TUFLOW logic conservative. Variables, wildcards, and scenario/event placeholders should not be reported as definitely missing.
- Keep domain logic in `src/lib` or `src/tuflow` where it can be unit tested.
- Follow the existing dense workbench UI style; do not add a landing page.
- Use lucide-react icons for UI actions where appropriate.
- Update README/help/docs when user-facing workflows or project rules change.

## Versioning

- The visible app version comes from `package.json`; do not hard-code it elsewhere.
- For normal working changes, use `npm run version:patch`.
- Before committing a feature or coherent change set, use `npm run version:minor`.
- When bumping versions, keep `package-lock.json` in sync.
- The user prefers asking Codex to commit so versioning and commit scope stay consistent.

## Verification

Use Windows-safe npm commands when PowerShell blocks `npm.ps1`:

```bash
npm.cmd test
npm.cmd run build
```

Expected package scripts:

```bash
npm run dev
npm run build
npm test
npm run preview
npm run version:patch
npm run version:minor
```

If build fails because CodeMirror packages cannot be resolved, check local dependency installation before treating it as a source-code regression.

## Safe Git Practice

- Do not revert user changes unless explicitly asked.
- Check `git status --short` before staging or committing.
- Keep commits scoped to the requested work.
- Do not commit generated or dependency artifacts unless they are intentional project files.

