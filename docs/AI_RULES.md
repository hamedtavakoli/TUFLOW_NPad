# AI Rules

These rules are for future AI coding assistants working on TUFLOW Command Studio. They are based on the current repository implementation, not generic project advice.

## Development Philosophy

- Treat TCS as a static, client-side TUFLOW modelling assistant.
- Preserve the existing browser-only persistence model unless the user explicitly asks for a new persistence design.
- Keep modelling workflows practical and compact. This is an operational editor, not a marketing site.
- Prefer conservative diagnostics. It is better to mark a variable or wildcard reference as uncheckable than to report a false missing file.
- Keep TUFLOW domain logic testable in `src/lib` or `src/tuflow` instead of burying it inside React components.
- Follow the existing application shape: `main.tsx` coordinates app state, components render UI, library modules own pure logic.

## Coding Standards

- Use TypeScript with strict types. Avoid `any`; if a browser API type is incomplete, define a narrow local interface like the existing directory-handle interfaces.
- Keep functions small and named by behavior.
- Prefer pure functions for parsing, validation, autocomplete, catalog normalisation, file classification, and comparison.
- Use `Set`, `Map`, and explicit normalisation helpers for path/name matching instead of repeated ad hoc string comparisons.
- Normalize project paths with backslashes for internal comparison, following `normaliseProjectPath`.
- Keep command name comparisons case-insensitive through the existing normalisation helpers.
- Keep user-facing strings concise and operational.
- Use ASCII in source unless the existing file or TUFLOW data requires otherwise.

## Refactoring Rules

- Do not refactor unrelated modules while making a feature change.
- Before changing parser, validator, command catalog, symbol, project file, or compare behavior, read the matching test file first.
- Preserve existing public function names and return shapes unless the caller changes are tightly scoped and tests are updated.
- Keep CodeMirror setup in `Editor.tsx` compartment-based unless there is a strong reason to change it.
- Do not move TUFLOW catalog loading out of `src/lib/commands.ts` without updating command source tests and README/docs.
- Avoid introducing global stores until React state in `main.tsx` becomes a proven blocker.

## UI Consistency Rules

- Maintain the dense panel layout: Command Guide, editor/compare area, Project Files, and Diagnostics.
- Use lucide-react icons for toolbar and panel action buttons.
- Keep controls compact: current buttons are generally 24-30px high with 5-7px border radius.
- Continue the restrained workbench visual language: light/dark CSS variables, fine borders, minimal shadows, teal accent, code-style editor typography.
- Keep cards limited to actual repeated/detail items such as command detail panels and file rows. Do not turn page sections into decorative cards.
- Do not add a landing page in front of the editor. The app should open directly into the usable workspace.
- Preserve dark theme coverage when adding new UI.
- Make text truncate or wrap predictably in narrow panels; project paths and command text can be long.
- Keep `body { min-width: 1120px; }` in mind: the current UI is desktop/workbench oriented, not mobile-first.

## Documentation Requirements

- Update `README.md` when feature behavior, version, deployment, command catalog source, supported file types, or workflows change.
- Update `public/help.html` when user-facing workflows or toolbar/panel behavior changes.
- Update these docs when project architecture, AI rules, roadmap, or handover context materially changes.
- Keep durable project facts in `AI_CONTEXT.md`.
- Keep temporary current-state notes in `SESSION_HANDOVER.md`.
- Clearly distinguish implemented features from proposed work.

## Versioning Rules

- The app version is displayed beside the title from `package.json`; do not hard-code the visible app version elsewhere.
- Use `npm run version:patch` for normal working changes.
- Use `npm run version:minor` before committing a feature or coherent change set.
- Prefer letting Codex handle commits when the user requests a commit so version bumps, staged files, and commit scope stay consistent.
- When bumping a version, verify the new `package.json` version and keep `package-lock.json` in sync.

## Testing Expectations

- Run `npm.cmd test` on Windows if `npm test` is blocked by PowerShell execution policy.
- For production readiness, run `npm.cmd run build`.
- Add or update Vitest coverage for changes in:
  - `src/lib/parser.ts`
  - `src/tuflow/parser/tuflowParser.ts`
  - `src/lib/validator.ts`
  - `src/lib/autocomplete.ts`
  - `src/lib/tuflowSymbols.ts`
  - `src/lib/projectFiles.ts`
  - `src/lib/projectFileBrowser.ts`
  - `src/lib/tuflowFileTypes.ts`
  - `src/lib/commandCatalog.ts`
  - `src/lib/valuePattern.ts`
  - `src/lib/textCompare.ts`
- Component changes should still be supported by tests around the underlying pure logic where practical.
- Command catalog changes must keep `commandsSource.test.ts` and catalog tests passing.

## TUFLOW-Specific Rules

- Do not hard-code one-off command behavior in UI components when it can be represented through command metadata, parser logic, value pattern classification, or symbol extraction.
- Treat `assets/tuflow_commands_2026.json` as the active runtime command source unless the user explicitly updates the catalog version.
- Preserve command variant handling, legacy flags, source URLs, value patterns, and control-file categories.
- Preserve `==` assignment semantics and the difference between commands that expect values and commands that do not.
- Preserve support for `!`, `#`, and `//` comments.
- Keep variables in the `<<NAME>>` form and event/scenario filename placeholders in the `~s~` / `~e~` family.
- Keep reference checks aware of variables, wildcards, placeholders, and ignored folders.
- Treat event/scenario logic checks as helpful warnings, not full TUFLOW execution semantics.
- When adding supported TUFLOW file types, update all relevant places: editor language extensions, readable project file extensions, file type catalog, project input classification, and tests.

## Safe-Change Principles

- Never silently change the meaning of Save. Current behavior downloads the active file.
- Never assume the browser can write to disk or retain file handles.
- Never report variable, wildcard, or placeholder paths as definitely missing.
- Preserve open-tab dirty state and before-unload protection.
- Preserve per-tab cursor, selection, scroll, undo, and redo behavior.
- Keep project root refresh explicit; do not imply live filesystem watching.
- Avoid introducing network dependencies into runtime app behavior.
- Keep GitHub Pages base path `/TUFLOW_NPad/` unless deployment target changes.
- Be careful with generated command data. Validate counts, duplicates, command variants, and value specs after changes.
- If changing compare logic, preserve side-by-side alignment, changed-only behavior, and ignore options.

## Known Local Environment Notes

- On this Windows environment, plain `npm test` may fail because PowerShell blocks `npm.ps1`. Use `npm.cmd test`.
- As of the latest handover, tests pass but production build fails locally if CodeMirror packages are missing from `node_modules`. Confirm dependency installation with `npm.cmd ls @codemirror/autocomplete @codemirror/commands @codemirror/state @codemirror/view` before treating that as a source-code regression.
