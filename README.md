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
- Command Help panel with active-line help and a searchable/filterable command library.
- Multi-file tabs with dirty markers and per-file editor state.

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

- `src/main.tsx` - app shell, tabs, Project Root state, validation status.
- `src/components/Editor.tsx` - CodeMirror editor, autocomplete, syntax decorations, search, problem highlights.
- `src/components/FilePanel.tsx` - Project Root controls and file browser.
- `src/components/CommandHelp.tsx` - line help and command library.
- `src/lib/commands.ts` - runtime command catalog loader.
- `src/lib/projectFiles.ts` - project indexing, excluded folder handling, readable file rules, and reference availability checks.
- `src/lib/projectFileBrowser.ts` - file browser filtering, grouping, and tree building.
- `src/lib/tuflowFileTypes.ts` - TUFLOW project file type catalog and category matching.
- `src/lib/editorLanguage.ts` - per-file editor language selection.
- `src/lib/validator.ts` - TUFLOW validation and project file checks.
- `src/lib/textCompare.ts` - side-by-side text comparison engine and compare options.
