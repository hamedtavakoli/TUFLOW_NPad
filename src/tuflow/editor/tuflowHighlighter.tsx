import type { ReactNode } from 'react';
import { isTuflowKeyword, tuflowIncludeReadWordSet } from '../language/tuflowKeywords';
import { parseTuflowLine, splitInlineComment, type TuflowAstLine } from '../parser/tuflowParser';

type TokenKind =
  | 'comment'
  | 'command'
  | 'keyword'
  | 'include'
  | 'operator'
  | 'file'
  | 'number'
  | 'string'
  | 'variable'
  | 'text';

interface HighlightToken {
  kind: TokenKind;
  text: string;
}

export function highlightTuflowLine(line: string, search: string, lineNumber = 1): ReactNode {
  const ast = parseTuflowLine(line, lineNumber);
  const tokens = tokenizeTuflowLine(line, ast);
  return renderTokens(tokens, search);
}

export function tokenizeTuflowLine(line: string, ast: TuflowAstLine): HighlightToken[] {
  if (ast.type === 'blank') {
    return [{ kind: 'text', text: line || ' ' }];
  }

  if (ast.type === 'comment') {
    return [{ kind: 'comment', text: line || ' ' }];
  }

  const { code, comment } = splitInlineComment(line);
  const assignmentIndex = code.indexOf('==');
  if (assignmentIndex < 0) {
    return [
      ...tokenizeWords(code, 'command'),
      ...(comment ? [{ kind: 'comment' as const, text: ` ${comment}` }] : [])
    ];
  }

  const commandText = code.slice(0, assignmentIndex);
  const valueText = code.slice(assignmentIndex + 2);
  return [
    ...tokenizeWords(commandText, 'command'),
    { kind: 'operator', text: '==' },
    ...tokenizeValue(valueText),
    ...(comment ? [{ kind: 'comment' as const, text: ` ${comment}` }] : [])
  ];
}

function tokenizeWords(text: string, fallback: TokenKind): HighlightToken[] {
  return splitKeepingWhitespace(text).map((part) => {
    if (/^\s+$/.test(part)) return { kind: 'text', text: part };
    const clean = part.replace(/[()[\],]/g, '');
    const firstWord = clean.split(/[\\/]/)[0];
    if (tuflowIncludeReadWordSet.has(clean.toLowerCase())) return { kind: 'include', text: part };
    if (isTuflowKeyword(clean) || isTuflowKeyword(firstWord)) return { kind: fallback, text: part };
    return { kind: 'text', text: part };
  });
}

function tokenizeValue(text: string): HighlightToken[] {
  const tokenPattern = /(<<[^>]+>>|~[^~]+~|"[^"]*"|'[^']*'|[^\s"'|,;]+(?:[\\/][^\s"'|,;]+)*\.[a-z0-9]+|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|\b[A-Za-z][A-Za-z0-9_/-]*\b|\s+)/gi;
  const tokens: HighlightToken[] = [];
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? cursor;
    if (index > cursor) {
      tokens.push({ kind: 'text', text: text.slice(cursor, index) });
    }
    tokens.push(classifyValueToken(token));
    cursor = index + token.length;
  }

  if (cursor < text.length) {
    tokens.push({ kind: 'text', text: text.slice(cursor) });
  }

  return tokens;
}

function classifyValueToken(token: string): HighlightToken {
  if (/^\s+$/.test(token)) return { kind: 'text', text: token };
  if (/^<<[^>]+>>$|^~[^~]+~$/.test(token)) return { kind: 'variable', text: token };
  if (/^"[^"]*"$|^'[^']*'$/.test(token)) return { kind: 'string', text: token };
  if (/[\\/].*\.[a-z0-9]+$|^\S+\.[a-z0-9]+$/i.test(token)) return { kind: 'file', text: token };
  if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(token)) return { kind: 'number', text: token };
  if (isTuflowKeyword(token)) return { kind: 'keyword', text: token };
  return { kind: 'text', text: token };
}

function renderTokens(tokens: HighlightToken[], search: string): ReactNode {
  return tokens.flatMap((token, tokenIndex) =>
    splitSearchMatches(token.text, search).map((part, partIndex) => (
      <span className={`${tokenClass(token.kind)}${part.match ? ' tok-search' : ''}`} key={`${tokenIndex}-${partIndex}`}>
        {part.text}
      </span>
    ))
  );
}

function splitSearchMatches(text: string, search: string): Array<{ text: string; match: boolean }> {
  const query = search.trim();
  if (!query) return [{ text, match: false }];

  const parts: Array<{ text: string; match: boolean }> = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let cursor = 0;
  let index = lowerText.indexOf(lowerQuery);

  while (index >= 0) {
    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), match: false });
    }
    parts.push({ text: text.slice(index, index + query.length), match: true });
    cursor = index + query.length;
    index = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }

  return parts.length > 0 ? parts : [{ text, match: false }];
}

function tokenClass(kind: TokenKind): string {
  return `tok-${kind}`;
}

function splitKeepingWhitespace(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}
