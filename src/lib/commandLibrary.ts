import { tuflowCommands } from './commands';
import type { TuflowCommand } from './types';

export type CommandLegacyFilter = 'all' | 'current' | 'legacy';

export interface CommandLibraryFilters {
  search: string;
  category: string;
  legacy: CommandLegacyFilter;
}

export const allCommandCategories = Array.from(new Set(tuflowCommands.map((command) => command.category))).sort((left, right) =>
  left.localeCompare(right)
);

export function filterCommandLibrary(
  commands: TuflowCommand[],
  { search, category, legacy }: CommandLibraryFilters
): TuflowCommand[] {
  const query = search.trim().toLowerCase();
  return commands
    .filter((command) => category === 'all' || command.category === category)
    .filter((command) => legacy === 'all' || (legacy === 'legacy' ? command.isLegacy : !command.isLegacy))
    .filter((command) => !query || commandSearchText(command).includes(query))
    .sort(compareCommands);
}

export function commandSearchText(command: TuflowCommand): string {
  return [
    command.name,
    command.syntax,
    command.summary,
    command.description,
    command.category,
    command.controlFile,
    command.commandPattern,
    command.sourcePage,
    command.solver,
    ...(command.allowedFileTypes ?? []),
    ...(command.aliases ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function compareCommands(left: TuflowCommand, right: TuflowCommand): number {
  return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
}
