import type { ParsedLine } from './types';

const inlineCommentPattern = /\s(?:!|#|\/\/).*/;
const placeholderPattern = /<<[^>]+>>|~[^~]+~/g;

export function stripInlineComment(line: string): string {
  return line.replace(inlineCommentPattern, '').trimEnd();
}

export function parseTuflowText(text: string): ParsedLine[] {
  return text.split(/\r?\n/).map((raw, index) => parseLine(raw, index + 1));
}

export function parseLine(raw: string, lineNumber: number): ParsedLine {
  const trimmed = raw.trim();
  const isBlank = trimmed.length === 0;
  const isComment = /^(!|#|\/\/)/.test(trimmed);
  const withoutComment = isComment ? trimmed : stripInlineComment(raw).trim();
  const assignmentIndex = withoutComment.indexOf('==');
  const hasAssignment = assignmentIndex >= 0;
  const commandText = hasAssignment
    ? withoutComment.slice(0, assignmentIndex).trim()
    : withoutComment.trim();
  const parameterText = hasAssignment
    ? withoutComment.slice(assignmentIndex + 2).trim()
    : '';

  return {
    lineNumber,
    raw,
    trimmed,
    isBlank,
    isComment,
    commandText,
    parameterText,
    hasAssignment,
    reference: detectReference(parameterText),
    placeholders: Array.from(raw.matchAll(placeholderPattern), (match) => match[0])
  };
}

export function normaliseCommandName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function detectReference(parameterText: string): string | undefined {
  const cleaned = parameterText.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) {
    return undefined;
  }

  const firstToken = cleaned.split(/\s+/)[0];
  if (/[\\/]/.test(firstToken) || /\.[a-z0-9]+$/i.test(firstToken)) {
    return firstToken;
  }

  return undefined;
}

export function getExtension(path: string): string {
  const match = path.toLowerCase().match(/(\.[a-z0-9]+)(?:$|\?)/);
  return match?.[1] ?? '';
}
