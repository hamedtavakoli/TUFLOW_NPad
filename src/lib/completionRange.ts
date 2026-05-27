import type { Suggestion } from './types';

export function completionStart(lineText: string, column: number, suggestions: Suggestion[]): number {
  const safeColumn = Math.min(Math.max(column, 0), lineText.length);
  const assignmentIndex = lineText.indexOf('==');
  if (assignmentIndex >= 0 && suggestions.some((suggestion) => suggestion.kind !== 'command')) {
    const afterAssignment = lineText.slice(assignmentIndex + 2, safeColumn);
    return assignmentIndex + 2 + (afterAssignment.match(/^\s*/)?.[0].length ?? 0);
  }

  if (suggestions.some((suggestion) => suggestion.kind === 'command')) {
    const prefix = lineText.slice(0, safeColumn);
    return prefix.match(/\S/)?.index ?? safeColumn;
  }

  const prefix = lineText.slice(0, safeColumn);
  const match = prefix.match(/[^\s]*$/);
  return safeColumn - (match?.[0].length ?? 0);
}
