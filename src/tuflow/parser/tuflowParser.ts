import { isTuflowKeyword, tuflowCommandLeadWordSet } from '../language/tuflowKeywords';

export type TuflowAstLineType = 'blank' | 'comment' | 'command' | 'unknown' | 'invalid';

export interface TuflowAstLine {
  lineNumber: number;
  raw: string;
  type: TuflowAstLineType;
  command?: string;
  operator?: string;
  value?: string;
  fileRefs: string[];
  inlineComment?: string;
  warnings: string[];
}

export interface TuflowCommandTokenCheck {
  normalisedCommand: string;
  tokens: string[];
  unknownTokens: string[];
  recognised: boolean;
}

interface SplitCommentResult {
  code: string;
  comment?: string;
}

const fileReferencePattern = /(?:"([^"]+\.[a-z0-9]+)"|'([^']+\.[a-z0-9]+)'|([^\s"'|,;]+(?:[\\/][^\s"'|,;]+)*\.[a-z0-9]+))/gi;

export function parseTuflowDocument(text: string): TuflowAstLine[] {
  return text.split(/\r?\n/).map((line, index) => parseTuflowLine(line, index + 1));
}

export function parseTuflowLine(raw: string, lineNumber: number): TuflowAstLine {
  const trimmed = raw.trim();
  const warnings: string[] = [];

  if (!trimmed) {
    return baseLine(lineNumber, raw, 'blank');
  }

  if (isLineComment(trimmed)) {
    return {
      ...baseLine(lineNumber, raw, 'comment'),
      inlineComment: trimmed
    };
  }

  const { code, comment } = splitInlineComment(raw);
  const assignmentIndex = code.indexOf('==');

  if (assignmentIndex < 0) {
    warnings.push('Missing == operator.');
    return {
      ...baseLine(lineNumber, raw, looksLikeCommand(code) ? 'invalid' : 'unknown'),
      command: code.trim() || undefined,
      inlineComment: comment,
      warnings
    };
  }

  const command = normaliseTuflowCommandText(code.slice(0, assignmentIndex));
  const value = code.slice(assignmentIndex + 2).trim();
  const tokenCheck = checkTuflowCommandTokens(command);

  if (!command) {
    warnings.push('Missing command before ==.');
  }
  if (!value) {
    warnings.push('Missing value after ==.');
  }
  if (command && tokenCheck.unknownTokens.length > 0) {
    warnings.push(`Possible typo in command word(s): ${tokenCheck.unknownTokens.join(', ')}.`);
  }

  return {
    lineNumber,
    raw,
    type: command ? 'command' : 'invalid',
    command: command || undefined,
    operator: '==',
    value,
    fileRefs: detectFileRefs(value),
    inlineComment: comment,
    warnings
  };
}

export function splitInlineComment(line: string): SplitCommentResult {
  let quote: '"' | "'" | undefined;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextTwo = line.slice(index, index + 2);

    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? undefined : quote ?? char;
      continue;
    }

    if (!quote && (char === '!' || char === '#' || nextTwo === '//')) {
      const hasLeadingSpace = index === 0 || /\s/.test(line[index - 1]);
      if (hasLeadingSpace) {
        return {
          code: line.slice(0, index).trimEnd(),
          comment: line.slice(index).trim()
        };
      }
    }
  }

  return { code: line.trimEnd() };
}

export function detectFileRefs(value: string): string[] {
  return Array.from(value.matchAll(fileReferencePattern), (match) => match[1] ?? match[2] ?? match[3]).filter(Boolean);
}

export function normaliseTuflowCommandText(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

export function splitTuflowCommandTokens(command: string): string[] {
  return normaliseTuflowCommandText(command)
    .split(/\s+/)
    .map((token) => token.replace(/^[()[\],]+|[()[\],]+$/g, ''))
    .filter(Boolean);
}

export function checkTuflowCommandTokens(command: string): TuflowCommandTokenCheck {
  const normalisedCommand = normaliseTuflowCommandText(command);
  const tokens = splitTuflowCommandTokens(normalisedCommand);
  const unknownTokens = tokens.filter((token) => !isTuflowKeyword(token));

  return {
    normalisedCommand,
    tokens,
    unknownTokens,
    recognised: tokens.length > 0 && unknownTokens.length === 0
  };
}

function baseLine(lineNumber: number, raw: string, type: TuflowAstLineType): TuflowAstLine {
  return {
    lineNumber,
    raw,
    type,
    fileRefs: [],
    warnings: []
  };
}

function isLineComment(trimmed: string): boolean {
  return trimmed.startsWith('!') || trimmed.startsWith('#') || trimmed.startsWith('//');
}

function looksLikeCommand(code: string): boolean {
  const firstWord = code.trim().split(/\s+/)[0];
  return Boolean(firstWord && tuflowCommandLeadWordSet.has(firstWord.toLowerCase()));
}
