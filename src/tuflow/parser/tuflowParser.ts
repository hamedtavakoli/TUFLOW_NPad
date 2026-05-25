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

  const command = code.slice(0, assignmentIndex).trim();
  const value = code.slice(assignmentIndex + 2).trim();

  if (!command) {
    warnings.push('Missing command before ==.');
  }
  if (!value) {
    warnings.push('Missing value after ==.');
  }
  if (command && !hasKnownCommandWord(command)) {
    warnings.push('Command is not recognised from the TUFLOW keyword list.');
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

function hasKnownCommandWord(command: string): boolean {
  return command.split(/\s+/).some((word) => isTuflowKeyword(word));
}
