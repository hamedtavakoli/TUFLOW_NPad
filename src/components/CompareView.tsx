import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, RotateCcw } from 'lucide-react';
import { getEditorLanguage, type EditorLanguage } from '../lib/editorLanguage';
import { tokenizeSyntaxLine, type SyntaxToken } from '../lib/syntaxHighlight';
import { compareText, type CompareLine, type CompareRow, type CompareTextSegment, type TextCompareOptions } from '../lib/textCompare';

interface CompareFileOption {
  id: string;
  name: string;
  text: string;
}

interface CompareViewProps {
  files: CompareFileOption[];
  onBackToEditor: () => void;
}

export function CompareView({ files, onBackToEditor }: CompareViewProps) {
  const [leftSourceId, setLeftSourceId] = useState(files[0]?.id ?? 'manual');
  const [rightSourceId, setRightSourceId] = useState(files[1]?.id ?? files[0]?.id ?? 'manual');
  const [leftManualText, setLeftManualText] = useState('');
  const [rightManualText, setRightManualText] = useState('');
  const [options, setOptions] = useState<TextCompareOptions>({
    ignoreBlankLines: false,
    ignoreExtraSpaces: false,
    ignoreCase: false,
    ignoreComments: false,
    changedOnly: false
  });
  const [debouncedLeftText, setDebouncedLeftText] = useState('');
  const [debouncedRightText, setDebouncedRightText] = useState('');
  const [activeChangeIndex, setActiveChangeIndex] = useState(0);
  const [isComparing, setIsComparing] = useState(false);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncingSideRef = useRef<'left' | 'right' | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    if (leftSourceId !== 'manual' && !files.some((file) => file.id === leftSourceId)) {
      setLeftSourceId(files[0]?.id ?? 'manual');
    }
    if (rightSourceId !== 'manual' && !files.some((file) => file.id === rightSourceId)) {
      setRightSourceId(files[1]?.id ?? files[0]?.id ?? 'manual');
    }
  }, [files, leftSourceId, rightSourceId]);

  const leftFile = files.find((file) => file.id === leftSourceId);
  const rightFile = files.find((file) => file.id === rightSourceId);
  const leftText = leftSourceId === 'manual' ? leftManualText : leftFile?.text ?? '';
  const rightText = rightSourceId === 'manual' ? rightManualText : rightFile?.text ?? '';
  const leftName = leftSourceId === 'manual' ? 'Manual left text' : leftFile?.name ?? 'Unreadable left file';
  const rightName = rightSourceId === 'manual' ? 'Manual right text' : rightFile?.name ?? 'Unreadable right file';
  const leftLanguage = leftSourceId === 'manual' ? 'plain' : getEditorLanguage(leftName);
  const rightLanguage = rightSourceId === 'manual' ? 'plain' : getEditorLanguage(rightName);
  const isLargeComparison = leftText.length + rightText.length > 80_000;
  const result = useMemo(() => compareText(debouncedLeftText, debouncedRightText, options), [debouncedLeftText, debouncedRightText, options]);
  const hasUnreadableFile = (leftSourceId !== 'manual' && !leftFile) || (rightSourceId !== 'manual' && !rightFile);
  const currentChangeLabel = result.changeCount === 0 ? 'Change 0 of 0' : `Change ${Math.min(activeChangeIndex || 1, result.changeCount)} of ${result.changeCount}`;

  useEffect(() => {
    setIsComparing(true);
    const delay = isLargeComparison ? 220 : 60;
    const timer = window.setTimeout(() => {
      setDebouncedLeftText(leftText);
      setDebouncedRightText(rightText);
      setIsComparing(false);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isLargeComparison, leftText, rightText]);

  useEffect(() => {
    setActiveChangeIndex(result.changeCount > 0 ? 1 : 0);
  }, [result.changeCount, options.changedOnly]);

  useEffect(() => {
    if (activeChangeIndex === 0) return;
    const row = rowRefs.current.get(activeChangeIndex);
    row?.scrollIntoView({ block: 'center' });
  }, [activeChangeIndex, result.rows]);

  const syncScroll = (side: 'left' | 'right') => {
    const source = side === 'left' ? leftScrollRef.current : rightScrollRef.current;
    const target = side === 'left' ? rightScrollRef.current : leftScrollRef.current;
    if (!source || !target || syncingSideRef.current === side) return;

    syncingSideRef.current = side === 'left' ? 'right' : 'left';
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => {
      syncingSideRef.current = null;
    });
  };

  const swapSides = () => {
    setLeftSourceId(rightSourceId);
    setRightSourceId(leftSourceId);
    setLeftManualText(rightManualText);
    setRightManualText(leftManualText);
  };

  const clearComparison = () => {
    setLeftSourceId('manual');
    setRightSourceId('manual');
    setLeftManualText('');
    setRightManualText('');
  };

  const moveChange = (direction: 1 | -1) => {
    if (result.changeCount === 0) return;
    setActiveChangeIndex((current) => {
      const safeCurrent = current || 1;
      if (direction > 0) return safeCurrent >= result.changeCount ? 1 : safeCurrent + 1;
      return safeCurrent <= 1 ? result.changeCount : safeCurrent - 1;
    });
  };

  return (
    <section className="compare-view">
      <div className="compare-toolbar">
        <div>
          <strong>Compare Files</strong>
          <span>{isComparing ? 'Comparing...' : result.isIdentical ? 'No differences found' : `${result.changeCount} change${result.changeCount === 1 ? '' : 's'}`}</span>
        </div>
        <div className="compare-actions">
          <button type="button" onClick={() => moveChange(-1)} disabled={result.changeCount === 0} title="Previous change">
            <ArrowUp size={15} />
            Previous
          </button>
          <button type="button" onClick={() => moveChange(1)} disabled={result.changeCount === 0} title="Next change">
            <ArrowDown size={15} />
            Next
          </button>
          <span className="compare-change-count">{currentChangeLabel}</span>
          <button type="button" onClick={swapSides} title="Swap left and right files">
            <ArrowLeftRight size={15} />
            Swap
          </button>
          <button type="button" onClick={clearComparison} title="Clear comparison">
            <RotateCcw size={15} />
            Clear
          </button>
          <button type="button" onClick={onBackToEditor}>Back to Editor</button>
        </div>
      </div>

      <div className="compare-option-bar">
        <CompareOption checked={options.ignoreBlankLines} label="Ignore blanks" onChange={(checked) => setOptions((current) => ({ ...current, ignoreBlankLines: checked }))} />
        <CompareOption checked={options.ignoreExtraSpaces} label="Ignore spaces" onChange={(checked) => setOptions((current) => ({ ...current, ignoreExtraSpaces: checked }))} />
        <CompareOption checked={options.ignoreCase} label="Ignore case" onChange={(checked) => setOptions((current) => ({ ...current, ignoreCase: checked }))} />
        <CompareOption checked={options.ignoreComments} label="Ignore comments" onChange={(checked) => setOptions((current) => ({ ...current, ignoreComments: checked }))} />
        <CompareOption checked={options.changedOnly} label="Changed only" onChange={(checked) => setOptions((current) => ({ ...current, changedOnly: checked }))} />
      </div>

      <div className="compare-source-grid">
        <CompareSource
          label="Left"
          sourceId={leftSourceId}
          files={files}
          manualText={leftManualText}
          onSourceChange={setLeftSourceId}
          onManualTextChange={setLeftManualText}
        />
        <CompareSource
          label="Right"
          sourceId={rightSourceId}
          files={files}
          manualText={rightManualText}
          onSourceChange={setRightSourceId}
          onManualTextChange={setRightManualText}
        />
      </div>

      {hasUnreadableFile ? <p className="compare-error">One selected file is no longer available. Choose another open tab or use manual text.</p> : null}

      <div className="compare-result-grid">
        <CompareResultPanel
          side="left"
          title={leftName}
          rows={result.rows}
          language={leftLanguage}
          activeChangeIndex={activeChangeIndex}
          rowRefs={rowRefs}
          scrollRef={leftScrollRef}
          onScroll={() => syncScroll('left')}
        />
        <CompareResultPanel
          side="right"
          title={rightName}
          rows={result.rows}
          language={rightLanguage}
          activeChangeIndex={activeChangeIndex}
          rowRefs={rowRefs}
          scrollRef={rightScrollRef}
          onScroll={() => syncScroll('right')}
        />
      </div>
    </section>
  );
}

function CompareOption({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="compare-option">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

interface CompareSourceProps {
  label: string;
  sourceId: string;
  files: CompareFileOption[];
  manualText: string;
  onSourceChange: (sourceId: string) => void;
  onManualTextChange: (text: string) => void;
}

function CompareSource({ label, sourceId, files, manualText, onSourceChange, onManualTextChange }: CompareSourceProps) {
  return (
    <div className="compare-source">
      <label>
        <span>{label} source</span>
        <select value={sourceId} onChange={(event) => onSourceChange(event.target.value)}>
          <option value="manual">Manual paste</option>
          {files.map((file) => (
            <option value={file.id} key={file.id}>{file.name}</option>
          ))}
        </select>
      </label>
      {sourceId === 'manual' ? (
        <textarea
          value={manualText}
          onChange={(event) => onManualTextChange(event.target.value)}
          spellCheck={false}
          placeholder={`Paste ${label.toLowerCase()} text here`}
        />
      ) : null}
    </div>
  );
}

interface CompareResultPanelProps {
  side: 'left' | 'right';
  title: string;
  rows: CompareRow[];
  language: EditorLanguage;
  activeChangeIndex: number;
  rowRefs: MutableRefObject<Map<number, HTMLDivElement>>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

function CompareResultPanel({ side, title, rows, language, activeChangeIndex, rowRefs, scrollRef, onScroll }: CompareResultPanelProps) {
  return (
    <div className="compare-panel">
      <div className="compare-panel-title" title={title}>{title}</div>
      <div className="compare-scroll" ref={scrollRef} onScroll={onScroll}>
        {rows.length === 0 ? (
          <div className="compare-empty">No text to compare.</div>
        ) : (
          rows.map((row) => (
            <CompareRowView
              row={row}
              side={side}
              language={language}
              isActiveChange={row.changeIndex === activeChangeIndex}
              rowRefs={rowRefs}
              key={`${side}-${row.id}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CompareRowView({
  row,
  side,
  language,
  isActiveChange,
  rowRefs
}: {
  row: CompareRow;
  side: 'left' | 'right';
  language: EditorLanguage;
  isActiveChange: boolean;
  rowRefs: MutableRefObject<Map<number, HTMLDivElement>>;
}) {
  const line = side === 'left' ? row.left : row.right;
  const kind = side === 'left' ? leftRowKind(row) : rightRowKind(row);

  return (
    <div
      className={`compare-row ${kind} ${isActiveChange ? 'active-change' : ''}`}
      ref={(element) => {
        if (side !== 'left' || !row.changeIndex) return;
        if (element) {
          rowRefs.current.set(row.changeIndex, element);
        } else {
          rowRefs.current.delete(row.changeIndex);
        }
      }}
    >
      <span className="compare-line-number">{line?.lineNumber ?? ''}</span>
      <code>{renderLineText(line, language)}</code>
    </div>
  );
}

function leftRowKind(row: CompareRow) {
  if (row.kind === 'added') return 'blank';
  return row.kind;
}

function rightRowKind(row: CompareRow) {
  if (row.kind === 'deleted') return 'blank';
  return row.kind;
}

function renderLineText(line: CompareLine | undefined, language: EditorLanguage) {
  if (!line) return '\u00a0';
  if (line.text.length === 0) return '\u00a0';
  return renderSyntaxSegments(tokenizeSyntaxLine(line.text, language, line.lineNumber), line.segments);
}

function renderSyntaxSegments(tokens: SyntaxToken[], compareSegments: CompareTextSegment[] | undefined) {
  if (!compareSegments) {
    return tokens.map((token, index) => (
      <span className={token.className} key={`${index}-${token.text}`}>
        {token.text}
      </span>
    ));
  }

  const changedRanges = compareChangedRanges(compareSegments);
  let cursor = 0;

  return tokens.flatMap((token, tokenIndex) => {
    const tokenStart = cursor;
    const tokenEnd = tokenStart + token.text.length;
    cursor = tokenEnd;

    return splitTokenByChangedRanges(token, tokenStart, tokenEnd, changedRanges).map((part, partIndex) => {
      const content = <span className={token.className}>{part.text}</span>;
      return part.changed ? (
        <mark key={`${tokenIndex}-${partIndex}-${part.text}`}>{content}</mark>
      ) : (
        <span className="compare-token-part" key={`${tokenIndex}-${partIndex}-${part.text}`}>{content}</span>
      );
    });
  });
}

function compareChangedRanges(compareSegments: CompareTextSegment[]) {
  const ranges: Array<{ from: number; to: number }> = [];
  let cursor = 0;

  for (const segment of compareSegments) {
    const from = cursor;
    const to = from + segment.text.length;
    if (segment.changed && to > from) {
      ranges.push({ from, to });
    }
    cursor = to;
  }

  return ranges;
}

function splitTokenByChangedRanges(
  token: SyntaxToken,
  tokenStart: number,
  tokenEnd: number,
  changedRanges: Array<{ from: number; to: number }>
) {
  const parts: Array<{ changed: boolean; text: string }> = [];
  let cursor = tokenStart;

  for (const range of changedRanges) {
    if (range.to <= tokenStart || range.from >= tokenEnd) continue;
    const changedStart = Math.max(range.from, tokenStart);
    const changedEnd = Math.min(range.to, tokenEnd);

    if (changedStart > cursor) {
      parts.push({ changed: false, text: token.text.slice(cursor - tokenStart, changedStart - tokenStart) });
    }
    if (changedEnd > changedStart) {
      parts.push({ changed: true, text: token.text.slice(changedStart - tokenStart, changedEnd - tokenStart) });
    }
    cursor = changedEnd;
  }

  if (cursor < tokenEnd) {
    parts.push({ changed: false, text: token.text.slice(cursor - tokenStart) });
  }

  return parts.length > 0 ? parts : [{ changed: false, text: token.text }];
}
