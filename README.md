# TUFLOW Command Studio

TUFLOW Command Studio (TCS) is a browser-based editor for TUFLOW control files and related project text files. The current app is a client-side React/Vite workspace with CodeMirror editing, TUFLOW command intelligence, project file indexing, diagnostics, and text comparison tools.

## Current Status

- **App version:** `0.7.0`
- **Runtime:** Static browser app built with React 19, TypeScript, Vite, CodeMirror 6, and Vitest.
- **Deployment target:** GitHub Pages at `https://hamedtavakoli.github.io/TUFLOW_NPad/`.
- **Persistence model:** Files are opened from the browser and saved by download. TCS warns before leaving the page when tabs have unsaved changes, but it does not write back to disk directly.
- **Project access model:** Modern browsers with the File System Access API can choose and refresh a model root folder and open readable indexed files from the Project Files panel. Browsers without directory picker support can still index project files by selecting/uploading them.
- **Command catalog:** Runtime command metadata comes from the 2026 JSON command catalog and currently contains 693 source records / 822 flattened command entries.

## What Works Now

### Editing workspace

- CodeMirror 6 editor for TUFLOW control-like files.
- Plain text editing for support files including `.csv`, `.log`, `.txt`, `.ini`, and `.cfg`.
- Batch/script syntax highlighting for `.bat` and `.cmd` files.
- Multi-file tabs with dirty markers.
- Per-tab editor state for active line, cursor, selection, scroll position, undo stack, and redo stack.
- New, open, save/download, undo, redo, format, compare, diagnostics export, help, and dark/light mode toolbar actions.
- Unsaved-change protection through a browser before-unload warning.

### TUFLOW language support

- TUFLOW syntax highlighting and command-aware decorations.
- Autocomplete for known commands and symbols.
- `Tab` accepts the selected autocomplete suggestion; `ArrowRight` accepts the next word of the selected suggestion.
- Formatting for TUFLOW control-style files.
- Validation for recognised TUFLOW control files.
- Variable, scenario, event, and symbol awareness through the parser/symbol index.
- Active-line command help with command syntax, expected value information, category, legacy status, and documentation links when available.
- Searchable/filterable command library with current/legacy filters.

### Project files and reference checks

- Project Root indexing with default ignored folders for common outputs/check/log/result areas.
- Configurable ignored folder names from the Project Files panel.
- Refreshable project index when the browser can retain a directory handle.
- Tree view and TUFLOW type view for indexed project files.
- Search by file name, path, or extension.
- Filters by recognised TUFLOW file type and extension.
- Open readable indexed project files directly into editor tabs when browser file content is available.
- Referenced file availability checks against the selected/indexed Project Root.
- Diagnostics panel with issue counts, clickable line navigation, selected-line syncing, and a Reference Checks toggle.
- Diagnostics export as JSON for the active file.

### Compare mode

- Side-by-side comparison of two open tabs or manually pasted text.
- Previous/next change navigation with active change highlighting.
- Left/right swap and clear actions.
- Synchronized scrolling between compare panes.
- Options to ignore blank lines, extra spaces, case, and comments.
- Changed-only view for focused review.
- Line and word-level highlighting for added, deleted, and modified content.

### Help and deployment

- Static offline help page bundled at `public/help.html` and linked from the app toolbar.
- GitHub Pages workflow configured in `.github/workflows/deploy-pages.yml` for pushes to `master`.

## Command Metadata

Runtime command metadata is loaded from:

- `assets/tuflow_commands_2026.json`

The matching CSV source is kept at:

- `assets/tuflow_commands_2026.csv`

The JSON catalog is the runtime source of truth for command names, variants, syntax/value patterns, summaries, legacy flags, categories, and documentation URLs. CSV files are kept for loader and normaliser workflows only.

## Local Development

Install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Verification

Run the automated test suite and production build:

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

- `src/main.tsx` - app shell, tabs, toolbar actions, Project Root state, validation state, and compare/editor workspace switching.
- `src/components/Editor.tsx` - CodeMirror editor, autocomplete, syntax decorations, search, problem highlights, and editor view-state callbacks.
- `src/components/FilePanel.tsx` - Project Root controls, project indexing UI, tree/type browser views, filters, and ignored folder management.
- `src/components/ProblemsPanel.tsx` - diagnostics list, Reference Checks toggle, and line navigation.
- `src/components/CommandHelp.tsx` - active-line command guide and searchable command library.
- `src/components/CompareView.tsx` - side-by-side text/file comparison UI.
- `src/lib/commands.ts` - runtime command catalog loader and command lookup helpers.
- `src/lib/projectFiles.ts` - project indexing, excluded folder handling, readable file rules, and reference availability checks.
- `src/lib/projectFileBrowser.ts` - file browser filtering, type grouping, and tree building.
- `src/lib/tuflowFileTypes.ts` - TUFLOW project file type catalog and category matching.
- `src/lib/editorLanguage.ts` - per-file editor language selection.
- `src/lib/parser.ts` and `src/tuflow/parser/tuflowParser.ts` - parsing helpers used by validation and language tooling.
- `src/lib/tuflowSymbols.ts` - symbol extraction/indexing for variables, scenarios, events, and related TUFLOW constructs.
- `src/lib/validator.ts` - TUFLOW validation and project file reference checks.
- `src/lib/formatter.ts` - TUFLOW formatting rules.
- `src/lib/textCompare.ts` - side-by-side text comparison engine and compare options.
- `public/help.html` - bundled offline help page.
