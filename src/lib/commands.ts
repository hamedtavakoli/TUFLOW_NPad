import commandData from '../../assets/tuflow_commands.json';
import type { TuflowCommand } from './types';
import { buildTuflowCommandCatalog, commandTokens, normaliseCommandText, type RawTuflowCommandRecord } from './commandCatalog';
import { getExtension, normaliseCommandName } from './parser';

const catalog = buildTuflowCommandCatalog(commandData.records as RawTuflowCommandRecord[]);

export const tuflowCommandCatalog = catalog;
export const tuflowCommands = catalog.variants.map(({ commandId, name, normalisedName, tokens }) => {
  const command = catalog.commands.find((candidate) => candidate.id === commandId);
  if (!command) {
    throw new Error(`Missing command catalog record for ${commandId}`);
  }

  const allowedFileTypes = inferAllowedFileTypes(name, command.valuePattern);
  const requiresFileReference = allowedFileTypes.length > 0 || looksLikeFileReferenceCommand(name, command.valuePattern);

  return {
    name,
    syntax: `${name}${command.hasValue ? ` == ${command.valuePattern ?? '<value>'}` : ''}`,
    description: buildDescription(command.controlFile, command.commandPattern, command.solver, command.isLegacy),
    category: command.controlFile,
    allowedFileTypes,
    examples: [buildExample(name, command.hasValue, command.valuePattern, allowedFileTypes)],
    requiresAssignment: command.hasValue,
    requiresFileReference,
    aliases: buildAliases(name, normalisedName),
    duplicatePolicy: shouldWarnOnDuplicate(name) ? 'warn' : 'allow',
    controlFile: command.controlFile,
    commandPattern: command.commandPattern,
    sourceUrl: command.sourceUrl,
    sourcePage: command.sourcePage,
    solver: command.solver,
    isLegacy: command.isLegacy,
    syntaxWarnings: command.syntaxWarnings,
    tokens
  } satisfies TuflowCommand;
});

const commandByName = new Map<string, TuflowCommand>();
const commandsByLooseName = tuflowCommands.slice().sort((a, b) => b.name.length - a.name.length);

tuflowCommands.forEach((command) => {
  [command.name, ...command.aliases].forEach((name) => {
    const key = normaliseCommandName(name);
    if (!commandByName.has(key)) {
      commandByName.set(key, command);
    }
  });
});

export function findCommand(commandText: string): TuflowCommand | undefined {
  const normalised = normaliseCommandName(commandText);
  const command = commandByName.get(normalised);
  return command ? withMatchedName(command, normalised) : findPlaceholderCommand(normalised);
}

export function findCommandInLooseLine(lineText: string): TuflowCommand | undefined {
  const normalised = normaliseCommandName(lineText);
  const match = commandsByLooseName.find((command) => {
    const names = [command.name, ...command.aliases].map(normaliseCommandName);
    return names.some((name) => normalised === name || normalised.startsWith(`${name} `));
  });
  return match ? withMatchedName(match, normalised) : findPlaceholderCommand(normalised);
}

export function commandStartsWith(input: string): TuflowCommand[] {
  const normalised = normaliseCommandName(input);
  const matches = tuflowCommands.flatMap((command) => {
    const names = [command.name, ...command.aliases];
    return names
      .filter((name) => normaliseCommandName(name).startsWith(normalised))
      .map((name) => ({ ...command, name, syntax: command.syntax.replace(command.name, name) }));
  }).sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));

  return uniqueCommands(matches).slice(0, 40);
}

export function getTuflowCommandTokenWords(): string[] {
  return Array.from(new Set(catalog.variants.flatMap((variant) => variant.tokens))).sort((a, b) => a.localeCompare(b));
}

function findPlaceholderCommand(normalised: string): TuflowCommand | undefined {
  if (!normalised) return undefined;

  return commandsByLooseName.find((command) => {
    if (!hasPlaceholder(command.name)) return false;
    const fixedTokens = commandTokens(command.name).filter((token) => !isPlaceholderToken(token));
    return fixedTokens.length > 0 && normalised === fixedTokens.join(' ');
  });
}

function withMatchedName(command: TuflowCommand, normalisedInput: string): TuflowCommand {
  const matchedName = [command.name, ...command.aliases].find((name) => {
    const normalisedName = normaliseCommandName(name);
    return normalisedInput === normalisedName || normalisedInput.startsWith(`${normalisedName} `);
  });
  return matchedName && matchedName !== command.name ? { ...command, name: matchedName, syntax: command.syntax.replace(command.name, matchedName) } : command;
}

function buildAliases(name: string, normalisedName: string): string[] {
  const aliases = new Set<string>();
  if (hasPlaceholder(name)) {
    const fixedName = commandTokens(name).filter((token) => !isPlaceholderToken(token)).join(' ');
    if (fixedName && fixedName !== normalisedName) aliases.add(toTitleishCommand(fixedName));
  }
  const familyAlias = genericReadAlias(normalisedName);
  if (familyAlias) aliases.add(familyAlias);
  return Array.from(aliases);
}

function buildDescription(controlFile: string, _commandPattern: string, solver?: string, isLegacy?: boolean): string {
  const details = [`TUFLOW ${controlFile} command`];
  if (solver) details.push(`${solver}.`);
  if (isLegacy) details.push('Legacy.');
  return details.join('\n');
}

function buildExample(name: string, hasValue: boolean, valuePattern: string | undefined, allowedFileTypes: string[]): string {
  if (!hasValue) return name;
  const exampleValue = allowedFileTypes[0] ? `path\\to\\input${allowedFileTypes[0]}` : valuePattern?.includes('folder') ? 'results\\' : '<value>';
  return `${name} == ${exampleValue}`;
}

function inferAllowedFileTypes(name: string, valuePattern: string | undefined): string[] {
  const source = `${name} ${valuePattern ?? ''}`.toLowerCase();
  const extensions = new Set<string>();

  for (const match of source.matchAll(/\.[a-z0-9]+(?:_file)?\b/g)) {
    extensions.add(match[0].replace(/_file$/, ''));
  }

  if (source.includes('gis_layer') || /\bread gis\b/.test(source)) {
    ['.shp', '.mif', '.gpkg', '.json', '.geojson'].forEach((extension) => extensions.add(extension));
  }
  if (source.includes('grid') || source.includes('raster')) {
    ['.asc', '.flt', '.tif', '.tiff', '.dem', '.grd'].forEach((extension) => extensions.add(extension));
  }
  if (source.includes('tin')) {
    ['.tin', '.12da', '.xml'].forEach((extension) => extensions.add(extension));
  }
  if (source.includes('csv')) {
    extensions.add('.csv');
  }
  if (source.includes('folder')) {
    extensions.add('');
  }

  return Array.from(extensions).filter(Boolean).sort();
}

function looksLikeFileReferenceCommand(name: string, valuePattern: string | undefined): boolean {
  const source = `${name} ${valuePattern ?? ''}`.toLowerCase();
  return /\b(file|folder|gis_layer|grid|tin|database)\b/.test(source) || Boolean(getExtension(source));
}

function shouldWarnOnDuplicate(name: string): boolean {
  return [
    'bc control file',
    'bc database',
    'cell size',
    'event file',
    'geometry control file',
    'output folder',
    'read materials file'
  ].includes(normaliseCommandText(name));
}

function hasPlaceholder(name: string): boolean {
  return commandTokens(name).some(isPlaceholderToken);
}

function isPlaceholderToken(token: string): boolean {
  return token.includes('?') || /^<.+>$/.test(token);
}

function genericReadAlias(normalisedName: string): string | undefined {
  if (normalisedName.startsWith('read gis ')) return 'Read GIS';
  if (normalisedName.startsWith('read grid ')) return 'Read GRID';
  if (normalisedName.startsWith('read tin ')) return 'Read TIN';
  if (normalisedName.startsWith('read rowcol ')) return 'Read RowCol';
  return undefined;
}

function toTitleishCommand(normalised: string): string {
  return normalised.split(' ').map((word) => word.toUpperCase() === word ? word : word[0].toUpperCase() + word.slice(1)).join(' ');
}

function uniqueCommands(commands: TuflowCommand[]): TuflowCommand[] {
  const seen = new Set<string>();
  return commands.filter((command) => {
    const key = `${command.controlFile ?? ''}:${normaliseCommandName(command.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
