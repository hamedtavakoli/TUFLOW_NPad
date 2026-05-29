import { normaliseCommandName, parseTuflowText } from './parser';

export type TuflowSymbolKind = 'variable' | 'event' | 'scenario';
export type TuflowLogicKind = 'event' | 'scenario';

export interface TuflowNamedSymbol {
  name: string;
  kind: TuflowSymbolKind;
  lineNumber: number;
  source: 'set-variable' | 'model-events' | 'model-scenarios' | 'define-event' | 'if-event' | 'if-scenario';
}

export interface TuflowVariableSymbol extends TuflowNamedSymbol {
  kind: 'variable';
  value: string;
  hasDelimitedName: boolean;
}

export interface TuflowVariableReference {
  name: string;
  raw: string;
  lineNumber: number;
}

export interface TuflowMalformedVariableReference {
  raw: string;
  lineNumber: number;
}

export interface TuflowPlaceholderReference {
  raw: string;
  lineNumber: number;
  group: 'event' | 'scenario' | 'unknown';
  index?: number;
  isValid: boolean;
}

export interface TuflowLogicProblem {
  lineNumber: number;
  severity: 'warning';
  message: string;
  suggestion?: string;
}

export interface TuflowSymbolIndex {
  variables: TuflowVariableSymbol[];
  variableReferences: TuflowVariableReference[];
  malformedVariableReferences: TuflowMalformedVariableReference[];
  events: TuflowNamedSymbol[];
  scenarios: TuflowNamedSymbol[];
  placeholders: TuflowPlaceholderReference[];
  logicProblems: TuflowLogicProblem[];
}

export const emptyTuflowSymbolIndex: TuflowSymbolIndex = {
  variables: [],
  variableReferences: [],
  malformedVariableReferences: [],
  events: [],
  scenarios: [],
  placeholders: [],
  logicProblems: []
};

const variableReferencePattern = /<<\s*([^<>]+?)\s*>>/g;
const placeholderPattern = /~([^~]+)~/g;

export function buildTuflowSymbolIndex(text: string): TuflowSymbolIndex {
  const variables: TuflowVariableSymbol[] = [];
  const variableReferences: TuflowVariableReference[] = [];
  const malformedVariableReferences: TuflowMalformedVariableReference[] = [];
  const events: TuflowNamedSymbol[] = [];
  const scenarios: TuflowNamedSymbol[] = [];
  const placeholders: TuflowPlaceholderReference[] = [];
  const logicProblems: TuflowLogicProblem[] = [];
  const logicStack: Array<{ kind: TuflowLogicKind; lineNumber: number }> = [];

  for (const line of parseTuflowText(text)) {
    if (line.isBlank || line.isComment) continue;

    const command = normaliseCommandName(line.commandText);
    const value = line.parameterText.trim();
    const setVariableName = line.commandText.match(/^set\s+variable\s+(.+)$/i)?.[1]?.trim();

    if (setVariableName && line.hasAssignment) {
      variables.push({
        name: stripVariableDelimiters(setVariableName),
        kind: 'variable',
        lineNumber: line.lineNumber,
        source: 'set-variable',
        value,
        hasDelimitedName: isDelimitedVariableName(setVariableName)
      });
    }

    collectVariableReferences(line.raw, line.lineNumber).forEach((reference) => {
      if (!isScenarioOrEventPlaceholder(reference.name)) {
        variableReferences.push(reference);
      }
    });
    malformedVariableReferences.push(...collectMalformedVariableReferences(line.raw, line.lineNumber));
    placeholders.push(...collectPlaceholders(line.raw, line.lineNumber));

    if (command === 'model events') {
      events.push(...valueNames(value).map((name) => namedSymbol(name, 'event', line.lineNumber, 'model-events')));
    }
    if (command === 'model scenarios') {
      scenarios.push(...valueNames(value).map((name) => namedSymbol(name, 'scenario', line.lineNumber, 'model-scenarios')));
    }
    if (command === 'define event') {
      events.push(...valueNames(value).map((name) => namedSymbol(name, 'event', line.lineNumber, 'define-event')));
    }
    if (command === 'if event' || command === 'else if event') {
      events.push(...valueNames(value).map((name) => namedSymbol(name, 'event', line.lineNumber, 'if-event')));
      updateLogicStack(command, 'event', line.lineNumber, logicStack, logicProblems);
    }
    if (command === 'if scenario' || command === 'else if scenario') {
      scenarios.push(...valueNames(value).map((name) => namedSymbol(name, 'scenario', line.lineNumber, 'if-scenario')));
      updateLogicStack(command, 'scenario', line.lineNumber, logicStack, logicProblems);
    }
    if (command === 'else') {
      if (logicStack.length === 0) {
        logicProblems.push({
          lineNumber: line.lineNumber,
          severity: 'warning',
          message: '"Else" appears without an open "If Event" or "If Scenario" block.'
        });
      }
    }
    if (command === 'end if') {
      if (logicStack.length === 0) {
        logicProblems.push({
          lineNumber: line.lineNumber,
          severity: 'warning',
          message: '"End If" appears without an open "If Event" or "If Scenario" block.'
        });
      } else {
        logicStack.pop();
      }
    }
  }

  logicStack.forEach((block) => {
    logicProblems.push({
      lineNumber: block.lineNumber,
      severity: 'warning',
      message: `"If ${block.kind === 'event' ? 'Event' : 'Scenario'}" block is missing "End If".`
    });
  });

  return {
    variables: uniqueSymbols(variables),
    variableReferences,
    malformedVariableReferences,
    events: uniqueSymbols(events),
    scenarios: uniqueSymbols(scenarios),
    placeholders,
    logicProblems
  };
}

export function activeFileVariableNames(symbols: TuflowSymbolIndex): string[] {
  return uniqueNames([
    ...symbols.variables.map((symbol) => symbol.name),
    ...symbols.events.map((symbol) => symbol.name),
    ...symbols.scenarios.map((symbol) => symbol.name)
  ]);
}

function updateLogicStack(
  command: string,
  kind: TuflowLogicKind,
  lineNumber: number,
  logicStack: Array<{ kind: TuflowLogicKind; lineNumber: number }>,
  logicProblems: TuflowLogicProblem[]
) {
  if (command.startsWith('else if')) {
    if (logicStack.length === 0) {
      logicProblems.push({
        lineNumber,
        severity: 'warning',
        message: `"Else If ${kind === 'event' ? 'Event' : 'Scenario'}" appears without an open "If" block.`
      });
    }
    return;
  }

  logicStack.push({ kind, lineNumber });
  if (logicStack.length > 10) {
    logicProblems.push({
      lineNumber,
      severity: 'warning',
      message: 'TUFLOW event/scenario logic blocks can only be nested up to 10 levels.'
    });
  }
}

function namedSymbol(
  name: string,
  kind: 'event' | 'scenario',
  lineNumber: number,
  source: TuflowNamedSymbol['source']
): TuflowNamedSymbol {
  return { name, kind, lineNumber, source };
}

function collectVariableReferences(raw: string, lineNumber: number): TuflowVariableReference[] {
  return Array.from(raw.matchAll(variableReferencePattern), (match) => ({
    name: match[1].trim(),
    raw: match[0],
    lineNumber
  }));
}

function collectMalformedVariableReferences(raw: string, lineNumber: number): TuflowMalformedVariableReference[] {
  const malformed = new Set<string>();
  for (const match of raw.matchAll(/<<[^\n<>]*(?![^<]*>>)/g)) {
    malformed.add(match[0].trim());
  }
  for (const match of raw.matchAll(/(?<!<)<[A-Za-z0-9_~.-]+>>/g)) {
    malformed.add(match[0].trim());
  }
  return Array.from(malformed)
    .filter(Boolean)
    .map((item) => ({ raw: item, lineNumber }));
}

function collectPlaceholders(raw: string, lineNumber: number): TuflowPlaceholderReference[] {
  return Array.from(raw.matchAll(placeholderPattern), (match) => {
    const token = match[1].trim().toLowerCase();
    const placeholder = token.match(/^([se])(\d*)$/);
    const group = placeholder?.[1] === 'e' ? 'event' : placeholder?.[1] === 's' ? 'scenario' : 'unknown';
    const index = placeholder?.[2] ? Number(placeholder[2]) : undefined;
    return {
      raw: match[0],
      lineNumber,
      group,
      index,
      isValid: Boolean(placeholder && (index === undefined || (index >= 1 && index <= 9)))
    };
  });
}

function valueNames(value: string): string[] {
  return uniqueNames(
    value
      .replace(/[()[\]]/g, ' ')
      .split(/[|,;\s]+/)
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter((item) => Boolean(item) && item !== '.' && !/^(?:and|or|not)$/i.test(item))
  );
}

function stripVariableDelimiters(name: string): string {
  return name.replace(/^<<\s*/, '').replace(/\s*>>$/, '').trim();
}

function isDelimitedVariableName(name: string): boolean {
  return /^<<.+>>$/.test(name.trim());
}

function isScenarioOrEventPlaceholder(name: string): boolean {
  return /^~[se](?:[1-9])?~$/i.test(name.trim());
}

function uniqueSymbols<T extends TuflowNamedSymbol>(symbols: T[]): T[] {
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    const key = `${symbol.kind}:${symbol.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
