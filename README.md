# TUFLOW Command Studio

A lightweight browser-based editor for TUFLOW flood modelling control files.

## Architecture

- `src/data/tuflowCommands.json` stores command definitions, expected syntax, descriptions, categories, examples, assignment requirements, and allowed file types.
- `src/lib/parser.ts` parses TUFLOW-style text into line records with command text, parameters, references, comments, assignments, and placeholders.
- `src/lib/validator.ts` turns parsed lines and registered project inputs into warnings/errors.
- `src/lib/autocomplete.ts` generates command and file suggestions from the active line, command rules, and project inputs.
- `src/lib/formatter.ts` provides a first small formatting pass for assignment spacing.
- `src/components/*` contains the IDE-style panels: editor, project inputs, problems, and command help.

## First Build

Included features:

- TUFLOW-style editor with line numbers, command highlighting, comments, assignment highlighting, search, and diagnostic markers.
- Project input panel with upload, drag-and-drop, and manual path registration.
- Command autocomplete for known TUFLOW commands.
- File/layer autocomplete filtered by expected command file types.
- Live validation for unknown commands, missing `==`, empty references, missing registered inputs, duplicate key commands, and suspicious file extensions.
- Problems panel with line navigation and suggested fixes.
- Command help panel driven by the active line and JSON command rules.
- Basic tests for parser, validator, autocomplete, and formatter.

## Command Rule Shape

```json
{
  "name": "Read GIS",
  "syntax": "Read GIS == <gis layer>",
  "description": "Reads a GIS layer containing model geometry, boundaries, or attributes.",
  "category": "GIS",
  "allowedFileTypes": [".shp", ".mif", ".gpkg", ".json", ".geojson"],
  "examples": ["Read GIS == gis\\2d_code_M01.shp"],
  "requiresAssignment": true,
  "requiresFileReference": true,
  "aliases": ["Read GIS Layer"]
}
```

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Future Improvements

- Replace the custom editor surface with Monaco or CodeMirror while keeping the existing parser, validator, and autocomplete modules.
- Add full TUFLOW command coverage from official/project reference documents.
- Add project workspace persistence with the File System Access API.
- Parse include/control-file relationships across `.tcf`, `.tgc`, `.tbc`, `.ecf`, `.tef`, `.trd`, and `.tsoilf`.
- Add quick fixes for common warnings.
- Add richer GIS layer metadata and geometry type awareness.
- Add scenario/event variable validation.
