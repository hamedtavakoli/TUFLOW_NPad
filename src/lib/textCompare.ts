export type CompareRowKind = 'unchanged' | 'added' | 'deleted' | 'modified';

export interface TextCompareOptions {
  ignoreBlankLines: boolean;
  ignoreExtraSpaces: boolean;
  ignoreCase: boolean;
  ignoreComments: boolean;
  changedOnly: boolean;
}

export interface CompareTextSegment {
  text: string;
  changed: boolean;
}

export interface CompareLine {
  lineNumber: number;
  text: string;
  segments?: CompareTextSegment[];
}

export interface CompareRow {
  id: string;
  kind: CompareRowKind;
  changeIndex?: number;
  left?: CompareLine;
  right?: CompareLine;
}

export interface TextCompareResult {
  rows: CompareRow[];
  allRows: CompareRow[];
  changeCount: number;
  isIdentical: boolean;
}

interface IndexedLine extends CompareLine {
  key: string;
}

interface Token {
  text: string;
  key: string;
}

type DiffOp =
  | { kind: 'equal'; left: IndexedLine; right: IndexedLine }
  | { kind: 'delete'; left: IndexedLine }
  | { kind: 'add'; right: IndexedLine };

const defaultOptions: TextCompareOptions = {
  ignoreBlankLines: false,
  ignoreExtraSpaces: false,
  ignoreCase: false,
  ignoreComments: false,
  changedOnly: false
};

export function compareText(leftText: string, rightText: string, options: Partial<TextCompareOptions> = {}): TextCompareResult {
  const compareOptions = { ...defaultOptions, ...options };
  const leftLines = toIndexedLines(leftText, compareOptions);
  const rightLines = toIndexedLines(rightText, compareOptions);
  const ops = buildLineOps(leftLines, rightLines);
  const allRows = numberChanges(combineModifiedRows(ops, compareOptions));
  const rows = compareOptions.changedOnly ? allRows.filter((row) => row.kind !== 'unchanged') : allRows;
  const changeCount = allRows.filter((row) => row.kind !== 'unchanged').length;

  return {
    rows,
    allRows,
    changeCount,
    isIdentical: changeCount === 0
  };
}

function toIndexedLines(text: string, options: TextCompareOptions): IndexedLine[] {
  const normalised = text.replace(/\r\n?/g, '\n');
  const lines = normalised.length === 0 ? [] : normalised.split('\n');

  return lines.flatMap((textLine, index) => {
    const key = normaliseLineKey(textLine, options);
    if (options.ignoreBlankLines && key.length === 0) return [];
    if (options.ignoreComments && isCommentLine(textLine)) return [];

    return [{
      lineNumber: index + 1,
      text: textLine,
      key
    }];
  });
}

function normaliseLineKey(text: string, options: TextCompareOptions): string {
  let key = text;
  if (options.ignoreExtraSpaces) {
    key = key.trim().replace(/\s+/g, ' ');
  }
  if (options.ignoreCase) {
    key = key.toLowerCase();
  }
  return key;
}

function isCommentLine(text: string): boolean {
  return /^\s*(?:!|#|\/\/|::|rem(?:\s|$))/i.test(text);
}

function buildLineOps(leftLines: IndexedLine[], rightLines: IndexedLine[]): DiffOp[] {
  const distances = buildLcsTable(leftLines, rightLines);
  const ops: DiffOp[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    if (leftLines[leftIndex].key === rightLines[rightIndex].key) {
      ops.push({ kind: 'equal', left: leftLines[leftIndex], right: rightLines[rightIndex] });
      leftIndex += 1;
      rightIndex += 1;
    } else if (distances[leftIndex + 1][rightIndex] >= distances[leftIndex][rightIndex + 1]) {
      ops.push({ kind: 'delete', left: leftLines[leftIndex] });
      leftIndex += 1;
    } else {
      ops.push({ kind: 'add', right: rightLines[rightIndex] });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftLines.length) {
    ops.push({ kind: 'delete', left: leftLines[leftIndex] });
    leftIndex += 1;
  }

  while (rightIndex < rightLines.length) {
    ops.push({ kind: 'add', right: rightLines[rightIndex] });
    rightIndex += 1;
  }

  return ops;
}

function buildLcsTable(leftLines: IndexedLine[], rightLines: IndexedLine[]): number[][] {
  const table = Array.from({ length: leftLines.length + 1 }, () => Array(rightLines.length + 1).fill(0));

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      table[leftIndex][rightIndex] =
        leftLines[leftIndex].key === rightLines[rightIndex].key
          ? table[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(table[leftIndex + 1][rightIndex], table[leftIndex][rightIndex + 1]);
    }
  }

  return table;
}

function combineModifiedRows(ops: DiffOp[], options: TextCompareOptions): CompareRow[] {
  const rows: CompareRow[] = [];
  let index = 0;

  while (index < ops.length) {
    const op = ops[index];

    if (op.kind === 'equal') {
      rows.push({
        id: `same-${op.left.lineNumber}-${op.right.lineNumber}`,
        kind: 'unchanged',
        left: op.left,
        right: op.right
      });
      index += 1;
      continue;
    }

    if (op.kind === 'delete') {
      const deleted: IndexedLine[] = [];
      const added: IndexedLine[] = [];

      while (ops[index]?.kind === 'delete') {
        deleted.push((ops[index] as Extract<DiffOp, { kind: 'delete' }>).left);
        index += 1;
      }

      while (ops[index]?.kind === 'add') {
        added.push((ops[index] as Extract<DiffOp, { kind: 'add' }>).right);
        index += 1;
      }

      rows.push(...pairChangedBlocks(deleted, added, options));
      continue;
    }

    rows.push({
      id: `added-${op.right.lineNumber}`,
      kind: 'added',
      right: op.right
    });
    index += 1;
  }

  return rows;
}

function pairChangedBlocks(deleted: IndexedLine[], added: IndexedLine[], options: TextCompareOptions): CompareRow[] {
  const rows: CompareRow[] = [];
  const pairedCount = Math.min(deleted.length, added.length);

  for (let index = 0; index < pairedCount; index += 1) {
    const { leftSegments, rightSegments } = diffLineWords(deleted[index].text, added[index].text, options);
    rows.push({
      id: `modified-${deleted[index].lineNumber}-${added[index].lineNumber}`,
      kind: 'modified',
      left: { ...deleted[index], segments: leftSegments },
      right: { ...added[index], segments: rightSegments }
    });
  }

  for (let index = pairedCount; index < deleted.length; index += 1) {
    rows.push({
      id: `deleted-${deleted[index].lineNumber}`,
      kind: 'deleted',
      left: deleted[index]
    });
  }

  for (let index = pairedCount; index < added.length; index += 1) {
    rows.push({
      id: `added-${added[index].lineNumber}`,
      kind: 'added',
      right: added[index]
    });
  }

  return rows;
}

function numberChanges(rows: CompareRow[]): CompareRow[] {
  let changeIndex = 0;
  return rows.map((row) => {
    if (row.kind === 'unchanged') return row;
    changeIndex += 1;
    return { ...row, changeIndex };
  });
}

function diffLineWords(leftText: string, rightText: string, options: TextCompareOptions) {
  const leftTokens = tokenizeLine(leftText, options);
  const rightTokens = tokenizeLine(rightText, options);
  const distances = buildTokenLcsTable(leftTokens, rightTokens);
  const leftSegments: CompareTextSegment[] = [];
  const rightSegments: CompareTextSegment[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftTokens.length && rightIndex < rightTokens.length) {
    if (leftTokens[leftIndex].key === rightTokens[rightIndex].key) {
      leftSegments.push({ text: leftTokens[leftIndex].text, changed: false });
      rightSegments.push({ text: rightTokens[rightIndex].text, changed: false });
      leftIndex += 1;
      rightIndex += 1;
    } else if (distances[leftIndex + 1][rightIndex] >= distances[leftIndex][rightIndex + 1]) {
      leftSegments.push({ text: leftTokens[leftIndex].text, changed: true });
      leftIndex += 1;
    } else {
      rightSegments.push({ text: rightTokens[rightIndex].text, changed: true });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftTokens.length) {
    leftSegments.push({ text: leftTokens[leftIndex].text, changed: true });
    leftIndex += 1;
  }

  while (rightIndex < rightTokens.length) {
    rightSegments.push({ text: rightTokens[rightIndex].text, changed: true });
    rightIndex += 1;
  }

  return {
    leftSegments: mergeSegments(leftSegments),
    rightSegments: mergeSegments(rightSegments)
  };
}

function tokenizeLine(text: string, options: TextCompareOptions): Token[] {
  const tokens = text.match(/\s+|[A-Za-z0-9_~<>./\\:-]+|./g) ?? [];
  return tokens.map((token) => ({
    text: token,
    key: options.ignoreCase ? token.toLowerCase() : token
  }));
}

function buildTokenLcsTable(leftTokens: Token[], rightTokens: Token[]): number[][] {
  const table = Array.from({ length: leftTokens.length + 1 }, () => Array(rightTokens.length + 1).fill(0));

  for (let leftIndex = leftTokens.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightTokens.length - 1; rightIndex >= 0; rightIndex -= 1) {
      table[leftIndex][rightIndex] =
        leftTokens[leftIndex].key === rightTokens[rightIndex].key
          ? table[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(table[leftIndex + 1][rightIndex], table[leftIndex][rightIndex + 1]);
    }
  }

  return table;
}

function mergeSegments(segments: CompareTextSegment[]): CompareTextSegment[] {
  return segments.reduce<CompareTextSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    if (previous?.changed === segment.changed) {
      previous.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
    return merged;
  }, []);
}
