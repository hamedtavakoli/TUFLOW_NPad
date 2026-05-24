import commandData from '../data/tuflowCommands.json';
import type { TuflowCommand } from './types';
import { normaliseCommandName } from './parser';

export const tuflowCommands = commandData as TuflowCommand[];

export function findCommand(commandText: string): TuflowCommand | undefined {
  const normalised = normaliseCommandName(commandText);
  return tuflowCommands.find((command) => {
    const names = [command.name, ...command.aliases].map(normaliseCommandName);
    return names.includes(normalised);
  });
}

export function findCommandInLooseLine(lineText: string): TuflowCommand | undefined {
  const normalised = normaliseCommandName(lineText);
  return tuflowCommands
    .slice()
    .sort((a, b) => b.name.length - a.name.length)
    .find((command) => {
      const names = [command.name, ...command.aliases].map(normaliseCommandName);
      return names.some((name) => normalised === name || normalised.startsWith(`${name} `));
    });
}

export function commandStartsWith(input: string): TuflowCommand[] {
  const normalised = normaliseCommandName(input);
  return tuflowCommands.filter((command) => {
    const names = [command.name, ...command.aliases].map(normaliseCommandName);
    return names.some((name) => name.startsWith(normalised));
  });
}
