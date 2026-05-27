import { commandStartsWith, findCommand, tuflowCommands } from './commands';
import { getExtension } from './parser';
import type { ProjectInput, Suggestion } from './types';

export function getAutocompleteSuggestions(lineText: string, inputs: ProjectInput[]): Suggestion[] {
  const assignmentIndex = lineText.indexOf('==');
  if (assignmentIndex >= 0) {
    const commandText = lineText.slice(0, assignmentIndex).trim();
    const partialValue = lineText.slice(assignmentIndex + 2).trim().replace(/^["']/, '');
    const partialReference = partialValue.toLowerCase();
    const command = findCommand(commandText);
    const allowedTypes = command?.allowedFileTypes ?? [];
    const shouldSuggestFiles = !command || command.requiresFileReference || allowedTypes.length > 0;
    const optionSuggestions =
      command?.valueSpec?.options
        .filter((option) => option.toLowerCase().startsWith(partialReference))
        .map((option) => ({
          label: option,
          detail: option === command.valueSpec?.defaultValue ? `Default option - ${command.name}` : `Option - ${command.name}`,
          insertText: option,
          kind: 'keyword' as const
        })) ?? [];

    const fileSuggestions = shouldSuggestFiles ? inputs
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
        kind: 'file' as const
      })) : [];

    const seen = new Set<string>();
    return [...optionSuggestions, ...fileSuggestions].filter((suggestion) => {
      const key = `${suggestion.kind}:${suggestion.label.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const trimmed = lineText.trimStart();
  const matches = trimmed ? commandStartsWith(trimmed) : tuflowCommands.slice(0, 8);
  return matches.map((command) => ({
    label: command.name,
    detail: commandSuggestionDetail(command.syntax, command.summary),
    insertText: command.requiresAssignment ? `${command.name} == ` : command.name,
    kind: 'command'
  }));
}

export function commandSuggestionDetail(syntax: string, summary: string | undefined): string {
  return summary ? `${syntax} - ${shortenSummary(summary)}` : syntax;
}

function shortenSummary(summary: string): string {
  const maxLength = 110;
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 3).trimEnd()}...` : summary;
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
