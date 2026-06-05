# Project Roadmap

This roadmap distinguishes implemented functionality from proposed next work. Recommendations are based on the current repository state, README, tests, source code, and existing TODO notes.

## High Priority

### Restore Build Health

Status: proposed.

Evidence:

- `npm.cmd test` passes 127 tests.
- `npm.cmd run build` currently fails because TypeScript cannot resolve CodeMirror packages.
- `npm.cmd ls @codemirror/autocomplete @codemirror/commands @codemirror/state @codemirror/view` returns `(empty)`.

Recommended work:

- Restore dependencies with `npm install` or `npm ci`.
- Confirm CodeMirror packages are installed.
- Re-run tests and production build.
- Do not begin larger refactors until build health is confirmed.

### Preserve Reference Check State Across Tab Changes

Status: proposed.

Evidence:

- `selectFile` in `src/main.tsx` resets `hasRunProjectValidation` to false.
- Existing TODO text says reference checks disappear when tab focus changes and the user has to run checks again.

Recommended work:

- Store reference-check state per open tab, or preserve reference-check visibility and status when switching tabs where appropriate.
- Keep the Reference Checks toggle behavior predictable.
- Add tests around validation state if logic is extracted from `main.tsx`.

### Clarify Active Versus Legacy Command Catalog Data

Status: proposed.

Evidence:

- Runtime code imports `assets/tuflow_commands_2026.json`.
- Older command data remains in `assets/tuflow_commands.json`, `assets/tuflow_commands.csv`, and `src/data/tuflowCommands.json`.

Recommended work:

- Document why older data remains, or remove it if confirmed obsolete.
- Keep `assets/tuflow_commands_2026.json` as the single runtime source of truth unless intentionally upgraded.
- Add a short note in README or data docs explaining the catalog generation/update process.

### Improve Scenario/Event Reference Handling Without False Positives

Status: proposed.

Evidence:

- Variables, scenarios, events, and placeholders are extracted.
- References with variables, wildcards, or placeholders are marked uncheckable.
- Existing TODO asks for file tree/reference handling inside scenarios and recognition of scenario/event variables from wildcards.

Recommended work:

- Preserve conservative uncheckable behavior by default.
- Add optional analysis that shows possible scenario/event-expanded references when data is available.
- Clearly label inferred paths as possible, not guaranteed.
- Cover wildcard/placeholder behavior with tests.

## Medium Priority

### Expand Formatting Carefully

Status: partially implemented.

Implemented:

- `formatTuflowText` normalises spacing around `==` and preserves comments.

Evidence for further work:

- Existing TODO says "Format??? Make nice formatting".

Recommended work:

- Define specific formatting rules before implementation.
- Avoid changing comments, indentation-sensitive logic, or values unexpectedly.
- Add before/after fixtures for control-file examples.

### Add Variable Reference Overview

Status: proposed.

Implemented foundation:

- `buildTuflowSymbolIndex` extracts variable definitions, references, scenarios, events, malformed references, placeholders, and logic problems.

Evidence for further work:

- Existing TODO asks to show the list of variables referred in the control file.

Recommended work:

- Add a compact variable/symbol section to Command Guide or Diagnostics.
- Show definitions, references, undefined references, scenarios, and events from the active file.
- Reuse `TuflowSymbolIndex` rather than reparsing in a component.

### Improve Project File Classification By Name

Status: partially implemented.

Implemented:

- `classifyInput` classifies common input categories by extension and selected path/name hints.
- `tuflowFileTypeCatalog` groups files by TUFLOW use category and file type.

Evidence for further work:

- Existing TODO asks to recognise input and output files in Project Files based on name.

Recommended work:

- Extend classification rules cautiously with tests.
- Avoid marking ambiguous files as definite input/output without evidence.
- Consider showing multiple possible TUFLOW type matches where extension overlaps.

### Improve Ignored Folder Messaging

Status: partially implemented.

Implemented:

- Ignored folders are listed, editable, and applied during project indexing.
- Excluded references can be reported as diagnostics.

Evidence for further work:

- Existing TODO asks for warning messages about ignored folders.

Recommended work:

- Make the Project Files panel clearer when files/folders are excluded.
- Consider count/status feedback after changing exclusions.
- Keep messaging compact.

### Review Compare Algorithm Against Real TUFLOW Files

Status: implemented but flagged for review.

Implemented:

- Custom LCS-based line diff.
- Word-level highlighting for modified lines.
- Ignore blank lines, spaces, case, and comments.
- Changed-only view and navigation.

Evidence for further work:

- Existing TODO says compare highlighting and compare logic should be investigated.

Recommended work:

- Test against representative TUFLOW control files.
- Add fixtures for scenario blocks, comments, paths, and command formatting changes.
- Consider performance limits for very large files.

## Low Priority

### Clean Up Utility Scripts

Status: proposed.

Evidence:

- `npm_in.bat` contains stale or invalid commands such as `npm run devts` and `npm run devld`.

Recommended work:

- Replace with a clean Windows helper script or remove it.
- Keep scripts aligned with `package.json`.

### Add Browser/Component Verification

Status: proposed.

Evidence:

- Current tests focus on pure logic.
- No browser UI or component tests are visible.

Recommended work:

- Add lightweight browser checks for app load, editor render, project panel controls, command library search, diagnostics click navigation, and compare mode.
- Keep unit tests as the main coverage for domain logic.

### Improve Help And README Drift Protection

Status: proposed.

Evidence:

- README and `public/help.html` are both detailed.
- Feature changes can easily update one and not the other.

Recommended work:

- Add a maintenance note in AI rules and README.
- Update help whenever workflows change.

### Investigate Value Pattern Encoding

Status: proposed.

Evidence:

- `src/lib/valuePattern.ts` includes mojibake-looking tokens for angle brackets and ellipsis.
- Tests currently pass.

Recommended work:

- Confirm whether command source data contains encoded angle-bracket variants.
- If cleaning this up, preserve tests for placeholder extraction and multiple-value detection.

## Future Ideas

### Safer File Write-Back

Status: future idea.

Current implementation:

- Save downloads the active file.

Possible direction:

- If requested, explore File System Access API write-back for browsers that support it.
- Keep download save as fallback.
- Make write permissions explicit and never overwrite silently.

### Richer Scenario/Event Expansion

Status: future idea.

Current implementation:

- Active-file scenarios, events, variables, and placeholders are recognised.
- Dynamic references remain uncheckable.

Possible direction:

- Offer a scenario/event expansion preview for references that use known `Model Scenarios`, `Model Events`, and placeholders.
- Keep inferred results separate from definitive availability checks.

### Reference Graph Or Dependency View

Status: future idea.

Current implementation:

- Project Files panel indexes and browses files.
- Validator checks active-file references.

Possible direction:

- Build a graph of which control files include/reference other files.
- Show missing references by project area or scenario.
- Start with active file only, then expand carefully.

### Change Log / Audit Notes

Status: future idea.

Evidence:

- Existing TODO mentions a log file for tracing changes of code.

Possible direction:

- Add a project changelog or development log document.
- If interpreted as an app feature, define whether it means editor change history, diagnostics export history, or repository development history before implementing.

### More Complete TUFLOW Semantics

Status: future idea.

Current implementation:

- TCS validates syntax-like patterns and references but is not a TUFLOW interpreter.

Possible direction:

- Expand semantic checks only when backed by reliable TUFLOW documentation/catalog data.
- Keep warnings explainable and optional where confidence is lower.

