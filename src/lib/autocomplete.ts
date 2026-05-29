import { commandStartsWith, findCommand, tuflowCommands } from './commands';
import { getExtension } from './parser';
import type { ProjectInput, Suggestion } from './types';
import { activeFileVariableNames, type TuflowSymbolIndex } from './tuflowSymbols';

const filenamePlaceholders = ['~s~', '~s1~', '~s2~', '~s3~', '~e~', '~e1~', '~e2~', '~e3~'];

export function getAutocompleteSuggestions(lineText: string, inputs: ProjectInput[], symbols?: TuflowSymbolIndex): Suggestion[] {
  const assignmentIndex = lineText.indexOf('==');
  if (assignmentIndex >= 0) {
    const commandText = lineText.slice(0, assignmentIndex).trim();
    const partialValue = lineText.slice(assignmentIndex + 2).trim().replace(/^["']/, '');
    const partialReference = partialValue.toLowerCase();
    const command = findCommand(commandText);
    const normalisedCommand = commandText.toLowerCase().replace(/\s+/g, ' ').trim();
    const symbolSuggestions = symbols ? symbolValueSuggestions(normalisedCommand, partialValue, symbols) : [];
    if (symbolSuggestions.length > 0) {
      return symbolSuggestions;
    }

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
    const placeholderSuggestions = partialReference.includes('~')
      ? filenamePlaceholders
        .filter((placeholder) => placeholder.toLowerCase().startsWith(partialReference.slice(partialReference.lastIndexOf('~'))))
        .map((placeholder) => ({
          label: placeholder,
          detail: placeholder.startsWith('~s') ? 'Scenario filename placeholder' : 'Event filename placeholder',
          insertText: placeholder,
          kind: 'snippet' as const
        }))
      : [];

    return [...optionSuggestions, ...fileSuggestions, ...placeholderSuggestions].filter((suggestion) => {
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
    detail: commandSuggestionDetail(command.name, command.syntax, command.summary),
    insertText: command.requiresAssignment ? `${command.name} == ` : command.name,
    kind: 'command',
    syntaxSuffix: commandSyntaxSuffix(command.name, command.syntax),
    summary: command.summary ? shortenText(command.summary, 90) : undefined
  }));
}

function symbolValueSuggestions(commandText: string, partialValue: string, symbols: TuflowSymbolIndex): Suggestion[] {
  if (/^set variable(?:\s|$)/.test(commandText)) {
    return [];
  }

  const trimmed = partialValue.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  if (commandText === 'if scenario' || commandText === 'else if scenario') {
    return symbols.scenarios
      .filter((symbol) => symbol.name.toLowerCase().startsWith(lowerTrimmed))
      .map((symbol) => ({
        label: symbol.name,
        detail: `Scenario - active file line ${symbol.lineNumber}`,
        insertText: symbol.name,
        kind: 'keyword' as const
      }));
  }

  if (commandText === 'if event' || commandText === 'else if event') {
    return symbols.events
      .filter((symbol) => symbol.name.toLowerCase().startsWith(lowerTrimmed))
      .map((symbol) => ({
        label: symbol.name,
        detail: `Event - active file line ${symbol.lineNumber}`,
        insertText: symbol.name,
        kind: 'keyword' as const
      }));
  }

  const variableStart = trimmed.lastIndexOf('<<');
  if (variableStart >= 0 && trimmed.indexOf('>>', variableStart) < 0) {
    const partialName = trimmed.slice(variableStart + 2).toLowerCase();
    return activeFileVariableNames(symbols)
      .filter((name) => name.toLowerCase().startsWith(partialName))
      .map((name) => ({
        label: `<<${name}>>`,
        detail: 'Variable - active file',
        insertText: `<<${name}>>`,
        kind: 'snippet' as const
      }));
  }

  return [];
}

export function commandSuggestionDetail(commandName: string, syntax: string, summary: string | undefined): string {
  const suffix = commandSyntaxSuffix(commandName, syntax);
  const syntaxDetail = suffix || syntax;
  return summary ? `${syntaxDetail} - ${shortenText(summary, 90)}` : syntaxDetail;
}

export function commandSyntaxSuffix(commandName: string, syntax: string): string {
  const suffix = syntax.startsWith(commandName) ? syntax.slice(commandName.length).replace(/^\s+/, ' ') : syntax;
  return shortenText(suffix, 90);
}

function shortenText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trimEnd()}...` : text;
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
