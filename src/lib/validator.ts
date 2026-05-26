import { findCommand, findCommandInLooseLine, tuflowCommands } from './commands';
import { getExtension, normaliseCommandName, parseTuflowText } from './parser';
import type { ParsedLine, Problem, ProjectInput } from './types';
import type { CommandValueSpec } from './valuePattern';
import { checkTuflowCommandTokens } from '../tuflow/parser/tuflowParser';

const severityRank = {
  error: 0,
  warning: 1,
  info: 2
} as const;

export function validateTuflowText(text: string, inputs: ProjectInput[]): Problem[] {
  return validateParsedLines(parseTuflowText(text), inputs);
}

export function validateParsedLines(lines: ParsedLine[], inputs: ProjectInput[]): Problem[] {
  const problems: Problem[] = [];

  for (const line of lines) {
    if (line.isBlank || line.isComment) {
      continue;
    }

    const exactCommand = line.hasAssignment ? findCommand(line.commandText) : undefined;
    const looseCommand = !line.hasAssignment ? findCommandInLooseLine(line.commandText) : undefined;
    const command = exactCommand ?? looseCommand;
    const tokenCheck = checkTuflowCommandTokens(command?.name ?? line.commandText);
    if (!command && tokenCheck.unknownTokens.length > 0) {
      problems.push({
        id: `command-token-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'warning',
        message: `Possible typo in command word(s): ${tokenCheck.unknownTokens.join(', ')}.`,
        suggestion: 'Check spelling against the TUFLOW keyword list.'
      });
    }

    if (!command) {
      if (!tokenCheck.recognised && tokenCheck.unknownTokens.length === 0) {
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

    if (command.requiresAssignment && !line.hasAssignment) {
      problems.push({
        id: `assignment-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'error',
        message: `"${command.name}" is missing the == assignment operator.`,
        suggestion: command.syntax
      });
    }

    const valueText = cleanValue(line.parameterText);
    const valueSpec = command.valueSpec;
    const matchedOption = matchesOption(valueText, valueSpec);
    const shouldValidateValue = line.hasAssignment && Boolean(valueSpec);

    if (line.hasAssignment && valueSpec && !valueSpec.expectsValue) {
      problems.push({
        id: `unexpected-assignment-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'error',
        message: `"${command.name}" does not use the == assignment operator.`,
        suggestion: command.name
      });
    }

    if (shouldValidateValue && valueSpec?.expectsValue && !valueText) {
      problems.push({
        id: `empty-value-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'error',
        message: `"${command.name}" needs a value after ==.`,
        suggestion: expectedValueSuggestion(valueSpec)
      });
    }

    if (shouldValidateValue && valueSpec && valueText && !matchedOption && expectsOnlyOptions(valueSpec)) {
      problems.push({
        id: `option-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'warning',
        message: `"${command.name}" expects one of: ${valueSpec.options.join(', ')}.`,
        suggestion: expectedValueSuggestion(valueSpec)
      });
    }

    if (
      shouldValidateValue &&
      valueSpec?.kinds.includes('number') &&
      valueText &&
      !matchedOption &&
      !line.reference &&
      !isNumericValue(valueText)
    ) {
      problems.push({
        id: `number-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'warning',
        message: `"${command.name}" expects a numeric value.`,
        suggestion: expectedValueSuggestion(valueSpec)
      });
    }

    const requiresConcreteReference =
      command.requiresFileReference && !matchedOption && !hasNonFileValueAlternative(valueSpec);

    if (requiresConcreteReference && line.hasAssignment && !line.reference) {
      problems.push({
        id: `empty-ref-${line.lineNumber}`,
        lineNumber: line.lineNumber,
        severity: 'error',
        message: `"${command.name}" needs a file or layer reference.`,
        suggestion: expectedValueSuggestion(valueSpec) ?? command.examples[0]
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

  return problems.sort(
    (a, b) =>
      a.lineNumber - b.lineNumber ||
      severityRank[a.severity] - severityRank[b.severity] ||
      a.message.localeCompare(b.message)
  );
}

function cleanValue(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
}

function matchesOption(value: string, valueSpec: CommandValueSpec | undefined): boolean {
  if (!value || !valueSpec?.options.length) {
    return false;
  }
  return valueSpec.options.some((option) => option.toLowerCase() === value.toLowerCase());
}

function expectsOnlyOptions(valueSpec: CommandValueSpec): boolean {
  const dynamicKinds = new Set(['file', 'folder', 'gis', 'number', 'string', 'list', 'variable', 'unknown']);
  return valueSpec.options.length > 0 && !valueSpec.kinds.some((kind) => dynamicKinds.has(kind));
}

function hasNonFileValueAlternative(valueSpec: CommandValueSpec | undefined): boolean {
  if (!valueSpec) {
    return false;
  }
  if (valueSpec.options.length > 0) {
    return true;
  }
  if (valueSpec.kinds.some((kind) => ['number', 'string', 'list', 'variable'].includes(kind))) {
    return true;
  }
  if (valueSpec.rawPattern?.toLowerCase().replace(/[_-]/g, ' ').includes('projection line')) {
    return true;
  }
  return valueSpec.placeholders.some((placeholder) => {
    const normalised = placeholder.toLowerCase().replace(/[_-]/g, ' ');
    if (normalised.includes('projection line')) {
      return true;
    }
    return !/\b(file|folder|layer|database|gis|grid|raster|tin|csv)\b/.test(normalised);
  });
}

function isNumericValue(value: string): boolean {
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?%?$/i.test(value.trim());
}

function expectedValueSuggestion(valueSpec: CommandValueSpec | undefined): string | undefined {
  if (!valueSpec) {
    return undefined;
  }
  if (valueSpec.options.length > 0) {
    return `Expected ${valueSpec.options.join(' or ')}.`;
  }
  if (valueSpec.defaultValue) {
    return `Default is ${valueSpec.defaultValue}.`;
  }
  return valueSpec.rawPattern;
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
