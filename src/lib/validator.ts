import { findCommand, findCommandInLooseLine, tuflowCommands } from './commands';
import { getExtension, normaliseCommandName, parseTuflowText } from './parser';
import { checkProjectFileAvailability, createProjectFileIndexFromInputs } from './projectFiles';
import type { ParsedLine, Problem, ProjectFileIndex, ProjectInput } from './types';
import type { CommandValueSpec } from './valuePattern';
import { checkTuflowCommandTokens } from '../tuflow/parser/tuflowParser';
import { activeFileVariableNames, buildTuflowSymbolIndex, type TuflowSymbolIndex } from './tuflowSymbols';

const severityRank = {
  error: 0,
  warning: 1,
  info: 2
} as const;

interface ValidationOptions {
  checkProjectFiles?: boolean;
  projectFileIndex?: ProjectFileIndex;
  symbols?: TuflowSymbolIndex;
}

export function validateTuflowText(text: string, inputs: ProjectInput[], options: ValidationOptions = {}): Problem[] {
  return validateParsedLines(parseTuflowText(text), inputs, {
    ...options,
    symbols: options.symbols ?? buildTuflowSymbolIndex(text)
  });
}

export function validateParsedLines(lines: ParsedLine[], inputs: ProjectInput[], options: ValidationOptions = {}): Problem[] {
  const problems: Problem[] = [];
  const availabilityIndex = options.projectFileIndex ?? createProjectFileIndexFromInputs('Project files', inputs);
  const symbols = options.symbols;
  const knownVariableNames = new Set(activeFileVariableNames(symbols ?? buildTuflowSymbolIndex(lines.map((line) => line.raw).join('\n'))).map((name) => name.toLowerCase()));

  if (symbols) {
    problems.push(...validateSymbols(symbols, knownVariableNames));
  }

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
    const valueUsesVariable = hasVariableReference(valueText);

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

    if (shouldValidateValue && valueSpec && valueText && !matchedOption && !valueUsesVariable && expectsOnlyOptions(valueSpec)) {
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
      !valueUsesVariable &&
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
      command.requiresFileReference && !matchedOption && !valueUsesVariable && !hasNonFileValueAlternative(valueSpec);

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

      if (command.allowedFileTypes.length > 0 && extension && !command.allowedFileTypes.includes(extension)) {
        problems.push({
          id: `extension-${line.lineNumber}`,
          lineNumber: line.lineNumber,
          severity: 'warning',
          message: `"${reference}" does not match expected type for "${command.name}".`,
          suggestion: `Expected ${command.allowedFileTypes.join(', ')}.`
        });
      }

      if (options.checkProjectFiles && shouldCheckFileAvailability(line, valueSpec)) {
        const availability = checkProjectFileAvailability(reference, availabilityIndex);
        if (availability.status === 'missing') {
          problems.push({
            id: `missing-input-${line.lineNumber}`,
            lineNumber: line.lineNumber,
            severity: 'warning',
            message: `Referenced input "${reference}" was not found in ${availabilityIndex.rootName}.`,
            suggestion: options.projectFileIndex ? 'Check the path or select the correct project root.' : 'Select a project root or correct the path.'
          });
        }
        if (availability.status === 'uncheckable') {
          problems.push({
            id: `uncheckable-input-${line.lineNumber}`,
            lineNumber: line.lineNumber,
            severity: 'info',
            message: `Referenced input "${reference}" contains variables or wildcards and cannot be fully checked.`,
            suggestion: 'Confirm the resolved TUFLOW scenario/event path exists.'
          });
        }
        if (availability.status === 'excluded') {
          problems.push({
            id: `excluded-input-${line.lineNumber}`,
            lineNumber: line.lineNumber,
            severity: 'info',
            message: `Referenced input "${reference}" is inside an excluded folder.`,
            suggestion: 'Remove that folder from exclusions if this input should be validated.'
          });
        }
      } else if (!options.checkProjectFiles && !inputs.some((input) => samePath(input.path, reference) || input.name === reference)) {
        problems.push({
          id: `missing-input-${line.lineNumber}`,
          lineNumber: line.lineNumber,
          severity: 'warning',
          message: `Referenced input "${reference}" was not found in the active project.`,
          suggestion: 'Select a project root or correct the path.'
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

function validateSymbols(symbols: TuflowSymbolIndex, knownVariableNames: Set<string>): Problem[] {
  const problems: Problem[] = [];

  symbols.variables
    .filter((variable) => variable.hasDelimitedName)
    .forEach((variable) => {
      problems.push({
        id: `variable-definition-${variable.lineNumber}`,
        lineNumber: variable.lineNumber,
        severity: 'warning',
        message: `"Set Variable" defines "${variable.name}" with <<...>> delimiters.`,
        suggestion: `Use "Set Variable ${variable.name} == ${variable.value}" when defining the variable.`
      });
    });

  symbols.malformedVariableReferences.forEach((reference, index) => {
    problems.push({
      id: `malformed-variable-${reference.lineNumber}-${index}`,
      lineNumber: reference.lineNumber,
      severity: 'warning',
      message: `Malformed variable reference "${reference.raw}".`,
      suggestion: 'Use variable references in the form <<VARIABLE_NAME>>.'
    });
  });

  symbols.variableReferences
    .filter((reference) => !knownVariableNames.has(reference.name.toLowerCase()))
    .forEach((reference) => {
      problems.push({
        id: `unknown-variable-${reference.lineNumber}-${reference.name}`,
        lineNumber: reference.lineNumber,
        severity: 'info',
        message: `Variable "${reference.name}" is not defined in the active file.`,
        suggestion: 'Define it with Set Variable, Model Events, Model Scenarios, or an event/scenario command in this file.'
      });
    });

  symbols.placeholders
    .filter((placeholder) => !placeholder.isValid)
    .forEach((placeholder, index) => {
      problems.push({
        id: `placeholder-${placeholder.lineNumber}-${index}`,
        lineNumber: placeholder.lineNumber,
        severity: 'warning',
        message: `Invalid event/scenario filename placeholder "${placeholder.raw}".`,
        suggestion: 'Use ~s~, ~s1~ to ~s9~, ~e~, or ~e1~ to ~e9~.'
      });
    });

  symbols.logicProblems.forEach((problem, index) => {
    problems.push({
      id: `logic-${problem.lineNumber}-${index}`,
      lineNumber: problem.lineNumber,
      severity: problem.severity,
      message: problem.message,
      suggestion: problem.suggestion
    });
  });

  return problems;
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

function shouldCheckFileAvailability(line: ParsedLine, valueSpec: CommandValueSpec | undefined): boolean {
  const reference = line.reference?.trim() ?? '';
  if (!reference) {
    return false;
  }
  if (/[\\/]$/.test(reference)) {
    return false;
  }
  return !valueSpec?.kinds.includes('folder');
}

function isNumericValue(value: string): boolean {
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?%?$/i.test(value.trim());
}

function hasVariableReference(value: string): boolean {
  return /<<\s*[^<>]+?\s*>>/.test(value);
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
