import { detectReference } from './parser';
import { isUncheckableReference } from './projectFiles';

interface ReferenceCandidate {
  from: number;
  to: number;
  reference: string;
}

export function referenceAtColumn(lineText: string, column: number): string | undefined {
  const candidate = referenceCandidate(lineText);
  if (!candidate || column < candidate.from || column > candidate.to) {
    return undefined;
  }
  if (!isOpenableReference(candidate.reference)) {
    return undefined;
  }
  return candidate.reference;
}

function referenceCandidate(lineText: string): ReferenceCandidate | undefined {
  const assignmentIndex = lineText.indexOf('==');
  if (assignmentIndex < 0) return undefined;

  const valueStart = assignmentIndex + 2;
  const valueText = lineText.slice(valueStart);
  const reference = detectReference(valueText);
  if (!reference) return undefined;

  const localRange = referenceRangeInValue(valueText, reference);
  if (!localRange) return undefined;

  return {
    from: valueStart + localRange.from,
    to: valueStart + localRange.to,
    reference
  };
}

function referenceRangeInValue(valueText: string, reference: string): { from: number; to: number } | undefined {
  const leadingWhitespaceLength = valueText.match(/^\s*/)?.[0].length ?? 0;
  const trimmedValue = valueText.slice(leadingWhitespaceLength);
  const quote = trimmedValue[0];

  if ((quote === '"' || quote === "'") && trimmedValue.slice(1, 1 + reference.length) === reference) {
    const from = leadingWhitespaceLength + 1;
    return { from, to: from + reference.length };
  }

  const from = valueText.indexOf(reference, leadingWhitespaceLength);
  return from >= 0 ? { from, to: from + reference.length } : undefined;
}

function isOpenableReference(reference: string): boolean {
  const trimmed = reference.trim();
  return Boolean(trimmed) && !isUncheckableReference(trimmed) && !/[\\/]$/.test(trimmed);
}
