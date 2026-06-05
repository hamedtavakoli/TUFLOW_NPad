import type { EditorLanguage } from './editorLanguage';
import { tokenizeTuflowLine } from '../tuflow/editor/tuflowHighlighter';
import { parseTuflowLine } from '../tuflow/parser/tuflowParser';

export interface SyntaxToken {
  className: string;
  text: string;
}

export function tokenizeSyntaxLine(line: string, language: EditorLanguage, lineNumber = 1): SyntaxToken[] {
  if (language === 'tuflow') {
    return tokenizeTuflowLine(line, parseTuflowLine(line, lineNumber)).map((token) => ({
      className: `tok-${token.kind}`,
      text: token.text
    }));
  }

  if (language === 'batch') {
    return tokenizeBatchLine(line);
  }

  return [{ className: 'tok-text', text: line || ' ' }];
}

function tokenizeBatchLine(line: string): SyntaxToken[] {
  if (!line) return [{ className: 'tok-text', text: ' ' }];

  const tokens: SyntaxToken[] = [];
  const trimmedStart = line.search(/\S/);
  const trimmed = trimmedStart >= 0 ? line.slice(trimmedStart) : '';

  if (/^(?:::|rem\b)/i.test(trimmed)) {
    if (trimmedStart > 0) tokens.push({ className: 'tok-text', text: line.slice(0, trimmedStart) });
    tokens.push({ className: 'tok-batch-comment', text: line.slice(trimmedStart) });
    return tokens;
  }

  const tokenPattern =
    /"[^"]*"|%[^%\s]+%|![^!\s]+!|\b(?:assoc|call|cd|choice|cls|copy|del|dir|do|echo|else|endlocal|erase|errorlevel|exist|exit|for|goto|if|in|mkdir|move|not|pause|popd|pushd|rem|ren|rmdir|robocopy|set|setlocal|shift|start|timeout|title|xcopy)\b|&&|\|\||[|&<>]/gi;
  const label = trimmed.match(/^:[^\s]+/);
  let cursor = 0;

  if (label && trimmedStart >= 0) {
    appendTextToken(tokens, line.slice(0, trimmedStart));
    tokens.push({ className: 'tok-batch-label', text: label[0] });
    cursor = trimmedStart + label[0].length;
  }

  tokenPattern.lastIndex = cursor;
  for (const match of line.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? cursor;
    if (index < cursor) continue;
    appendTextToken(tokens, line.slice(cursor, index));
    tokens.push({ className: batchTokenClass(token), text: token });
    cursor = index + token.length;
  }

  appendTextToken(tokens, line.slice(cursor));
  return tokens.length > 0 ? tokens : [{ className: 'tok-text', text: line }];
}

function appendTextToken(tokens: SyntaxToken[], text: string) {
  if (text) tokens.push({ className: 'tok-text', text });
}

function batchTokenClass(token: string): string {
  if (/^"/.test(token)) return 'tok-batch-string';
  if (/^%|^!/.test(token)) return 'tok-batch-variable';
  if (/^(?:&&|\|\||[|&<>])$/.test(token)) return 'tok-batch-operator';
  return 'tok-batch-keyword';
}
