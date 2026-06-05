# AI Context

## Project Purpose

TUFLOW Command Studio (TCS) is a browser-based editor and review workspace for TUFLOW control files and related project text files. It helps modellers edit control files, understand TUFLOW commands, index a selected model root, validate referenced files, inspect diagnostics, and compare text or open files.

The application is intentionally client-side. It runs as a static React/Vite app, uses browser file APIs for opening and indexing files, and saves edited content by downloading files rather than writing directly back to disk.

## Project Goals

- Provide a practical TUFLOW-aware editor for `.tcf`, `.tgc`, `.tbc`, `.tef`, `.ecf`, `.toc`, `.trd`, `.qcf`, and related control-style files.
- Reduce command spelling and syntax mistakes using command metadata, autocomplete, active-line help, and diagnostics.
- Help users understand and manage project file references by indexing a model root and checking referenced paths.
- Support day-to-day review workflows with multi-file tabs, search, formatting, diagnostics export, and side-by-side compare.
- Remain deployable as a static GitHub Pages app with no server-side dependency.

## Current Version And Runtime

- App version: `0.7.0` from `package.json`.
- Runtime target: static browser app.
- Deployment target: GitHub Pages using Vite base path `/TUFLOW_NPad/`.
- CI/deployment workflow: `.github/workflows/deploy-pages.yml` runs `npm ci`, `npm test`, `npm run build`, then deploys `dist` to GitHub Pages on pushes to `master`.

## Technology Stack

- React 19 and React DOM 19.
- TypeScript 5.8 with `strict: true`.
- Vite 7 with `@vitejs/plugin-react`.
- CodeMirror 6 packages for the editor, autocomplete, editor state, commands, and view extensions.
- `lucide-react` for toolbar and panel icons.
- Vitest 3 for unit tests.
- Static HTML help page in `public/help.html`.

## Folder Structure Overview

- `.github/workflows/`: GitHub Pages deployment workflow.
- `assets/`: TUFLOW command catalog sources and app image asset.
  - `tuflow_commands_2026.json`: active runtime command catalog.
  - `tuflow_commands_2026.csv`: matching source/loader data.
  - `tuflow_commands.json` and `.csv`: older command catalog assets retained in the repo.
- `docs/`: project notes and AI memory documents.
  - `todo.docx`: legacy/current TODO notes extracted during review.
  - `recap.txt`: currently empty.
- `public/`: static files copied by Vite.
  - `help.html`: bundled offline user help page.
- `src/components/`: React UI components.
- `src/lib/`: pure or mostly pure application logic for parsing, validation, autocomplete, project file indexing, command catalogs, formatting, and compare.
- `src/tuflow/`: TUFLOW-specific parser, highlighter, and language keyword support.
- `src/test/`: Vitest unit tests for library behavior.
- `src/data/`: older static command data. Runtime code currently imports from `assets/tuflow_commands_2026.json`, not this folder.

## Application Architecture

The app is a single-page React workspace.

`src/main.tsx` owns the top-level state:

- Theme.
- Editor versus compare mode.
- Open file tabs and per-tab editor state.
- Active file selection.
- Undo/redo stacks.
- Project root index and directory handle.
- Ignored folder names.
- Validation status and whether reference checks are visible.
- Active TUFLOW symbol index for the active file.

The main layout is a dense editor workspace:

- Left: `CommandHelp`, with active-line guide and searchable command library.
- Center: `Editor` or `CompareView`.
- Right: `FilePanel`, with model-root indexing and file browsing.
- Bottom: `ProblemsPanel`, with diagnostics and reference-check toggle.

CodeMirror is managed inside `src/components/Editor.tsx`. It uses compartments to reconfigure syntax highlighting, diagnostics, autocomplete sources, and search decorations without recreating the editor. Per-tab cursor, selection, scroll, active line, undo stack, and redo stack are held in React state.

Most domain logic lives in testable library modules under `src/lib/` and `src/tuflow/`. UI components call these modules rather than embedding validation, parsing, or compare logic directly.

## Major Implemented Features

### Editing Workspace

- CodeMirror 6 editing surface.
- Multi-file tabs with dirty markers.
- New file creation with a TUFLOW starter template.
- Open multiple readable files through browser file input.
- Save active file by downloading text.
- Unsaved-change protection using `beforeunload`.
- Per-tab view state: active line, cursor, selection, scroll position.
- App-level undo/redo stacks per tab.
- Search highlighting and previous/next search navigation.
- Dark/light theme toggle stored in `localStorage`.
- Static offline help page linked from the toolbar.

### TUFLOW Language Support

- TUFLOW syntax highlighting for control-like extensions.
- Batch syntax highlighting for `.bat` and `.cmd`.
- Plain text editing for support files.
- Command autocomplete from the active 2026 command catalog.
- Value autocomplete for known project files and documented command options.
- Variable autocomplete for `<<...>>` references.
- Scenario/event autocomplete for `If Scenario`, `Else If Scenario`, `If Event`, and `Else If Event`.
- Filename placeholder suggestions for scenario/event placeholders such as `~s~`, `~s1~`, `~e~`, and `~e1~`.
- `Tab` accepts the selected completion.
- `ArrowRight` accepts the next word of the selected completion.
- Formatting for TUFLOW files, currently focused on normalising spacing around `==` while preserving comments.

### Command Guide And Library

- Active-line command lookup.
- Command syntax, category, description/summary, expected value details, legacy flag, and documentation links.
- Searchable command library.
- Category and legacy/current filters.
- Library display capped at 120 commands until filters are narrowed.

### Validation And Diagnostics

- Unknown command warnings.
- Possible typo warnings based on TUFLOW keyword tokens.
- Missing or unexpected `==` assignment checks.
- Empty value checks.
- Option value checks for fixed-option commands.
- Numeric value checks.
- File/reference extension checks.
- Missing input checks against the active project index.
- Uncheckable reference notices for variables, wildcards, and placeholders.
- Excluded-folder notices.
- Variable definition and malformed variable reference checks.
- Undefined active-file variable reference notices.
- Event/scenario filename placeholder validation.
- Basic `If Event` / `If Scenario` / `Else` / `Else If` / `End If` block checks.
- Diagnostics panel with clickable line navigation.
- Diagnostics export as JSON.

### Project File Indexing

- Choose model root using the File System Access API where supported.
- Fallback project indexing through directory/file input.
- Refresh retained directory handles where available.
- Open readable indexed files directly into editor tabs when file sources are available.
- Default ignored folders: `results`, `result`, `log`, `logs`, `check`, `checks`.
- User-editable ignored folder list.
- Project file tree view.
- TUFLOW type view grouped by control/input/output/check/other categories.
- Search by name, path, or extension.
- Filters by TUFLOW use category and extension.
- Readable project file extension allowlist in `src/lib/projectFiles.ts`.

### Compare Mode

- Compare two open tabs or manually pasted text.
- Side-by-side result panels.
- Previous/next change navigation.
- Active change highlighting.
- Swap sides.
- Clear comparison.
- Synchronized scrolling.
- Options to ignore blank lines, extra spaces, case, and comments.
- Changed-only view.
- Line-level and word-level diff highlighting.
- Debounced comparison for larger inputs.

## Data Sources And Configuration Files

- Runtime command metadata: `assets/tuflow_commands_2026.json`.
- Command source CSV: `assets/tuflow_commands_2026.csv`.
- Older command metadata: `assets/tuflow_commands.json`, `assets/tuflow_commands.csv`, and `src/data/tuflowCommands.json`.
- TUFLOW keyword seed list: embedded Notepad++ keyword XML in `src/tuflow/language/tuflowKeywords.ts`, merged with command catalog token words.
- File type catalog: `src/lib/tuflowFileTypes.ts`.
- Readable file extension catalog: `src/lib/projectFiles.ts`.
- TUFLOW editor-language extension list: `src/lib/editorLanguage.ts`.
- TypeScript config: `tsconfig.json`, `tsconfig.node.json`.
- Vite/Vitest config: `vite.config.ts`.
- Package scripts and dependency versions: `package.json`.
- Deployment workflow: `.github/workflows/deploy-pages.yml`.

The 2026 JSON catalog contains 693 source records. The README states this is flattened into 822 command entries at runtime.

## Important Design Decisions

- Static browser app: there is no backend and no direct filesystem write-back.
- Save means download: future work should not silently change this persistence model.
- Project root is an index, not a live filesystem watcher.
- Reference checks are conservative: variables, wildcards, and event/scenario placeholders are reported as uncheckable rather than falsely missing.
- Open tabs are merged into the availability index so active in-editor files can participate in checks.
- TUFLOW-specific behavior is concentrated in `src/lib` and `src/tuflow` and covered by unit tests.
- UI is dense and work-focused, with panels, compact controls, 6-7px radii, low-shadow styling, and CodeMirror as the editor core.
- The command catalog is generated/normalised from source metadata instead of hard-coding individual commands in UI code.
- Tests emphasize pure domain logic and data transforms rather than component rendering.

## TUFLOW-Specific Concepts And Terminology

- Control files: `.tcf`, `.tgc`, `.tbc`, `.tef`, `.ecf`, `.toc`, `.qcf`, `.trd`, `.erd`, `.rdf`, and related files used to configure a TUFLOW model.
- Assignment operator: TUFLOW commands commonly use `Command == Value`.
- Model Root: selected root folder used as the base for checking referenced files.
- Project inputs: indexed files classified as GIS, Raster, Terrain, Boundary, Materials, Rainfall, Control, Folder, or Other.
- File references: values that look like relative paths or filenames with extensions.
- Variables: `Set Variable NAME == value` definitions and `<<NAME>>` references.
- Events: values from `Model Events`, `Define Event`, and event condition commands.
- Scenarios: values from `Model Scenarios` and scenario condition commands.
- Event/scenario filename placeholders: `~e~`, `~e1~` to `~e9~`, `~s~`, `~s1~` to `~s9~`.
- Logic blocks: `If Event`, `If Scenario`, `Else If Event`, `Else If Scenario`, `Else`, and `End If`.
- Legacy commands: command catalog entries marked `is_legacy`.
- TUFLOW use categories: Control File, Input File, Output File, Check File, Other.

## Key Workflows Supported

1. Edit a TUFLOW control file.
   - Open or create a file.
   - Use autocomplete and syntax highlighting.
   - Use the active-line command guide.
   - Format the file.
   - Download the edited file.

2. Check project references.
   - Choose a model root.
   - Let TCS index files and folders.
   - Run Check References on a TUFLOW file.
   - Review diagnostics and jump to issue lines.
   - Export diagnostics as JSON.

3. Browse a model root.
   - Search indexed files.
   - Filter by TUFLOW type or extension.
   - Switch between tree view and type view.
   - Open readable indexed files in editor tabs.
   - Adjust ignored folders and refresh the index.

4. Investigate commands.
   - Select a command line for context-specific help.
   - Search the command library.
   - Filter current versus legacy commands.
   - Open TUFLOW documentation links where available.

5. Compare files or pasted text.
   - Switch to compare mode.
   - Select open tabs or manual text.
   - Navigate changes.
   - Toggle ignore options.
   - Review line and word changes.

## Evidence Of Current Maturity

The repository has broad unit test coverage for parser, validator, autocomplete, command catalog, command source data, project file indexing/browser behavior, TUFLOW symbols, file type matching, value pattern classification, formatting, editor language selection, text comparison, and TUFLOW keyword/parser modules. As of this review, `npm.cmd test` passes 127 tests across 17 test files.

