import { findCommand, findCommandInLooseLine, tuflowCommands } from './commands';
import { getExtension, normaliseCommandName, parseTuflowText } from './parser';
import type { ParsedLine, Problem, ProjectInput } from './types';
import { checkTuflowCommandTokens } from '../tuflow/parser/tuflowParser';

export function validateTuflowText(text: string, inputs: ProjectInput[]): Problem[] {
  return validateParsedLines(parseTuflowText(text), inputs);
}

export function validateParsedLines(lines: ParsedLine[], inputs: ProjectInput[]): Problem[] {
  const problems: Problem[] = [];
  const commandOccurrences = new Map<string, number[]>();

  for (const line of lines) {
    if (line.isBlank || line.isComment) {
      continue;
    }

    const looseCommand = !line.hasAssignment ? findCommandInLooseLine(line.commandText) : undefined;
    const tokenCheck = checkTuflowCommandTokens(looseCommand?.name ?? line.commandText);
    const command = findCommand(tokenCheck.normalisedCommand) ?? looseCommand;
    if (tokenCheck.unknownTokens.length > 0) {
      problems.push({
        id: `command-token-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'warning',
        message: `Possible typo in command word(s): ${tokenCheck.unknownTokens.join(', ')}.`,
        suggestion: 'Check spelling against the TUFLOW keyword list.'
      });
    }

    if (!command) {
      if (tokenCheck.recognised) {
        problems.push({
          id: `unknown-phrase-${line.lineNumber}`,
          lineNumber: line.lineNumber,
          severity: 'warning',
          message: `Command phrase "${tokenCheck.normalisedCommand}" is not in the configured command definitions yet.`,
          suggestion: 'Token spelling looks valid; phrase-level command coverage can be added later.'
        });
      } else if (tokenCheck.unknownTokens.length === 0) {
        problems.push({
          id: `unknown-${line.lineNumber}`,
          lineNumber: line.lineNumber,
          severity: 'warning',
          message: `Unknown TUFLOW command "${tokenCheck.normalisedCommand}".`,
          suggestion: closestCommandSuggestion(tokenCheck.normalisedCommand)
        });
      }
      continue;
    }

    const commandKey = normaliseCommandName(command.name);
    commandOccurrences.set(commandKey, [...(commandOccurrences.get(commandKey) ?? []), line.lineNumber]);

    if (command.requiresAssignment && !line.hasAssignment) {
      problems.push({
        id: `assignment-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'error',
        message: `"${command.name}" is missing the == assignment operator.`,
        suggestion: command.syntax
      });
    }

    if (command.requiresFileReference && line.hasAssignment && !line.reference) {
      problems.push({
        id: `empty-ref-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'error',
        message: `"${command.name}" needs a file or layer reference.`,
        suggestion: command.examples[0]
      });
    }

    if (line.reference) {
      const reference = line.reference;
      const extension = getExtension(reference);
      const matchedInput = inputs.some((input) => samePath(input.path, reference) || input.name === reference);

      if (command.allowedFileTypes.length > 0 && extension && !command.allowedFileTypes.includes(extension)) {
        problems.push({
          id: `extension-${line.lineNumber}`,
          lineNumber: line.lineNumber,
          severity: 'warning',
          message: `"${reference}" does not match expected type for "${command.name}".`,
          suggestion: `Expected ${command.allowedFileTypes.join(', ')}.`
        });
      }

      if (!matchedInput) {
        problems.push({
          id: `missing-input-${line.lineNumber}`,
          lineNumber: line.lineNumber,
          severity: 'warning',
          message: `Referenced input "${reference}" is not registered in the project panel.`,
          suggestion: 'Add it to Project Inputs or correct the path.'
        });
      }
    }
  }

  for (const command of tuflowCommands) {
    const linesForCommand = commandOccurrences.get(normaliseCommandName(command.name)) ?? [];
    if (command.duplicatePolicy === 'warn' && linesForCommand.length > 1) {
      for (const lineNumber of linesForCommand.slice(1)) {
        problems.push({
          id: `duplicate-${command.name}-${lineNumber}`,
          lineNumber,
          severity: 'warning',
          message: `"${command.name}" appears more than once.`,
          suggestion: 'Check whether this override is intentional.'
        });
      }
    }
  }

  return problems.sort((a, b) => a.lineNumber - b.lineNumber);
}

function samePath(left: string, right: string): boolean {
  return left.replaceAll('/', '\\').toLowerCase() === right.replaceAll('/', '\\').toLowerCase();
}

function closestCommandSuggestion(commandText: string): string | undefined {
  const input = normaliseCommandName(commandText);
  if (!input) {
    return undefined;
  }

  const candidate = tuflowCommands
    .map((command) => ({ command, distance: levenshtein(input, normaliseCommandName(command.name)) }))
    .sort((a, b) => a.distance - b.distance)[0];

  return candidate && candidate.distance <= 5 ? `Did you mean "${candidate.command.name}"?` : undefined;
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, row) => [row]);
  for (let col = 1; col <= b.length; col += 1) {
    matrix[0][col] = col;
  }
  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      matrix[row][col] =
        a[row - 1] === b[col - 1]
          ? matrix[row - 1][col - 1]
          : Math.min(matrix[row - 1][col - 1] + 1, matrix[row][col - 1] + 1, matrix[row - 1][col] + 1);
    }
  }
  return matrix[a.length][b.length];
}
