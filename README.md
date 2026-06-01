# TUFLOW Command Studio

TUFLOW Command Studio (TCS) is a browser-based editor for TUFLOW control files and related project text files.

## Current Command Source

Runtime command metadata is loaded from:

- `assets/tuflow_commands_2026.json`

The matching CSV source is kept at:

- `assets/tuflow_commands_2026.csv`

The JSON catalog is the runtime source of truth for command names, variants, syntax/value patterns, summaries, legacy flags, and documentation URLs. CSV files are kept for loader and normaliser workflows only.

## Features

- CodeMirror 6 editor for TUFLOW control-like files.
- TUFLOW syntax highlighting, autocomplete, validation, formatting, and command help for TUFLOW control files.
- Plain text editing for support files such as `.csv`, `.log`, `.txt`, `.ini`, and `.cfg`.
- Batch syntax highlighting for `.bat` and `.cmd` files.
- New, open, save, undo, redo, and dark/light mode controls from the main toolbar.
- Multi-file tabs with dirty markers and per-file cursor, selection, scroll, and undo/redo state.
- Project Root indexing with configurable excluded folders.
- Project file browser with tree and TUFLOW type views, search, type filters, and extension filters.
- Open indexed project files directly from the Project Files panel when browser file access is available.
- Referenced file availability validation against the selected Project Root.
- Diagnostics panel with selectable problem rows, a Reference Checks toggle, and diagnostics export.
- Command Guide panel with active-line help and a searchable/filterable command library.
- Side-by-side compare mode for open files or manually pasted text, with change navigation, synced scrolling, side swapping, clear controls, and ignore options for blanks, spaces, case, comments, and unchanged lines.

## Typical Workflow

1. Choose a Model Root in the Project Files panel so TCS can index project files and check referenced paths.
2. Open or create TUFLOW control files and related support files.
3. Use autocomplete, formatting, syntax highlighting, the active-line Command Guide, and the searchable Library while editing.
4. Run **Check References** to refresh diagnostics for the active file.
5. Review Diagnostics, toggle Reference Checks when needed, jump to problem lines, or export diagnostics.
6. Use **Compare** to review differences between open tabs or manually pasted text.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Verify

```bash
npm test
npm run build
```

The production build may show a non-fatal large chunk warning because the app bundles CodeMirror and the TUFLOW command JSON.

## GitHub Pages

The app is configured for deployment at:

```text
https://hamedtavakoli.github.io/TUFLOW_NPad/
```

Deployment is handled by `.github/workflows/deploy-pages.yml` on pushes to `master`. In the GitHub repository settings, set Pages source to GitHub Actions.

## Key Files

- `src/main.tsx` - app shell, toolbar actions, tabs, Project Root state, validation status, workspace mode, and file operations.
- `src/components/Editor.tsx` - CodeMirror editor, autocomplete, syntax decorations, search, problem highlights, and per-file view state.
- `src/components/FilePanel.tsx` - Project Root controls, indexing status, file browser search/filtering, and tree/type views.
- `src/components/ProblemsPanel.tsx` - diagnostics list, Reference Checks toggle, and problem-line navigation.
- `src/components/CommandHelp.tsx` - active-line command guide and searchable/filterable command library.
- `src/components/CompareView.tsx` - side-by-side file/manual-text comparison UI.
- `src/lib/commands.ts` - runtime command catalog loader.
- `src/lib/projectFiles.ts` - project indexing, excluded folder handling, readable file rules, and reference availability checks.
- `src/lib/projectFileBrowser.ts` - file browser filtering, grouping, and tree building.
- `src/lib/tuflowFileTypes.ts` - TUFLOW project file type catalog and category matching.
- `src/lib/editorLanguage.ts` - per-file editor language selection.
- `src/lib/validator.ts` - TUFLOW validation and project file checks.
- `src/lib/textCompare.ts` - side-by-side text comparison engine and compare options.
