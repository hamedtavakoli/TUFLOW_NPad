import commandData from '../../assets/tuflow_commands_2026.json';
import type { TuflowCommand } from './types';
import { buildTuflowCommandCatalog, commandTokens, type RawTuflowCommandRecord } from './commandCatalog';
import { normaliseCommandName } from './parser';

const catalog = buildTuflowCommandCatalog(commandData.records as RawTuflowCommandRecord[]);

export const tuflowCommandCatalog = catalog;
export const tuflowCommands = catalog.variants.map(({ commandId, name, tokens }) => {
  const command = catalog.commands.find((candidate) => candidate.id === commandId);
  if (!command) {
    throw new Error(`Missing command catalog record for ${commandId}`);
  }

  const allowedFileTypes = command.valueSpec.extensions;
  const requiresFileReference = allowedFileTypes.length > 0 || command.valueSpec.kinds.includes('file') || command.valueSpec.kinds.includes('gis');

  return {
    name,
    syntax: `${name}${command.hasValue ? ` == ${command.valuePattern ?? '<value>'}` : ''}`,
    description: command.summary ?? buildDescription(command.controlFile, command.commandPattern, command.solver, command.isLegacy),
    summary: command.summary,
    category: command.controlFile,
    allowedFileTypes,
    examples: [buildExample(name, command.hasValue, command.valuePattern, allowedFileTypes)],
    requiresAssignment: command.hasValue,
    requiresFileReference,
    aliases: [],
    duplicatePolicy: 'allow',
    controlFile: command.controlFile,
    commandPattern: command.commandPattern,
    sourceUrl: command.sourceUrl,
    sourcePage: command.sourcePage,
    solver: command.solver,
    isLegacy: command.isLegacy,
    syntaxWarnings: command.syntaxWarnings,
    tokens,
    valueSpec: command.valueSpec
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
    const fixedName = fixedTokens.join(' ');
    return fixedTokens.length > 0 && (normalised === fixedName || normalised.startsWith(`${fixedName} `));
  });
}

function withMatchedName(command: TuflowCommand, normalisedInput: string): TuflowCommand {
  const matchedName = [command.name, ...command.aliases].find((name) => {
    const normalisedName = normaliseCommandName(name);
    return normalisedInput === normalisedName || normalisedInput.startsWith(`${normalisedName} `);
  });
  return matchedName && matchedName !== command.name ? { ...command, name: matchedName, syntax: command.syntax.replace(command.name, matchedName) } : command;
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

function hasPlaceholder(name: string): boolean {
  return commandTokens(name).some(isPlaceholderToken);
}

function isPlaceholderToken(token: string): boolean {
  return token.includes('?') || /^<.+>$/.test(token);
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
