import { commandStartsWith, findCommand, tuflowCommands } from './commands';
import { getExtension } from './parser';
import type { ProjectInput, Suggestion } from './types';

export function getAutocompleteSuggestions(lineText: string, inputs: ProjectInput[]): Suggestion[] {
  const assignmentIndex = lineText.indexOf('==');
  if (assignmentIndex >= 0) {
    const commandText = lineText.slice(0, assignmentIndex).trim();
    const partialReference = lineText.slice(assignmentIndex + 2).trim().toLowerCase();
    const command = findCommand(commandText);
    const allowedTypes = command?.allowedFileTypes ?? [];

    return inputs
      .filter((input) => {
        const matchesType = allowedTypes.length === 0 || allowedTypes.includes(input.extension);
        const matchesText =
          input.path.toLowerCase().includes(partialReference) || input.name.toLowerCase().includes(partialReference);
        return matchesType && matchesText;
      })
      .map((input) => ({
        label: input.name,
        detail: `${input.type} - ${input.path}`,
        insertText: input.path,
        kind: 'file'
      }));
  }

  const trimmed = lineText.trimStart();
  const matches = trimmed ? commandStartsWith(trimmed) : tuflowCommands.slice(0, 8);
  return matches.map((command) => ({
    label: command.name,
    detail: command.syntax,
    insertText: command.requiresAssignment ? `${command.name} == ` : command.name,
    kind: 'command'
  }));
}

export function classifyInput(name: string, path = name): ProjectInput {
  const extension = getExtension(path || name);
  const lowered = `${name} ${path}`.toLowerCase();
  const type = (() => {
    if (['.shp', '.mif', '.gpkg', '.geojson', '.json'].includes(extension)) return 'GIS';
    if (['.asc', '.flt', '.tif', '.tiff', '.dem', '.grd'].includes(extension)) return 'Raster';
    if (['.tin', '.12da', '.xml'].includes(extension)) return 'Terrain';
    if (['.tcf', '.tgc', '.tbc', '.ecf', '.tef', '.trd', '.tsoilf'].includes(extension)) return 'Control';
    if (['.tmf'].includes(extension) || lowered.includes('material')) return 'Materials';
    if (lowered.includes('rain') || lowered.includes('rainfall')) return 'Rainfall';
    if (lowered.includes('bc') || lowered.includes('boundary')) return 'Boundary';
    return 'Other';
  })();

  return {
    id: `${path}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}`,
    name,
    path,
    extension,
    type
  };
}
