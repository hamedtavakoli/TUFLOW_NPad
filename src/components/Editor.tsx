import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { getAutocompleteSuggestions } from '../lib/autocomplete';
import type { Problem, ProjectInput, Suggestion } from '../lib/types';
import { highlightTuflowLine } from '../tuflow/editor/tuflowHighlighter';

interface EditorFileTab {
  id: string;
  name: string;
  isDirty: boolean;
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  fileTabs: EditorFileTab[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onCloseFile: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  inputs: ProjectInput[];
  problems: Problem[];
  activeLine: number;
  onActiveLineChange: (line: number) => void;
  requestedLine: { lineNumber: number; nonce: number } | null;
  search: string;
  onSearchChange: (search: string) => void;
}

export function Editor({
  value,
  onChange,
  fileTabs,
  activeFileId,
  onSelectFile,
  onCloseFile,
  onUndo,
  onRedo,
  inputs,
  problems,
  activeLine,
  onActiveLineChange,
  requestedLine,
  search,
  onSearchChange
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [cursorOffset, setCursorOffset] = useState(0);
  const lines = value.split('\n');
  const currentLine = getLineAtOffset(value, cursorOffset);
  const currentLineText = lines[currentLine.lineNumber - 1] ?? '';
  const currentLinePrefix = currentLineText.slice(0, currentLine.column);
  const suggestions = useMemo(() => getAutocompleteSuggestions(currentLinePrefix, inputs).slice(0, 8), [currentLinePrefix, inputs]);
  const problemLines = new Map(problems.map((problem) => [problem.lineNumber, problem]));
  const suggestionTop = 12 + Math.max(0, currentLine.lineNumber - 1) * 22 - (textareaRef.current?.scrollTop ?? 0);
  const suggestionLeft = 72 + Math.min(currentLine.column * 8.4, 520) - (textareaRef.current?.scrollLeft ?? 0);

  const updateCursorLine = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setCursorOffset(textarea.selectionStart);
    onActiveLineChange(getLineAtOffset(textarea.value, textarea.selectionStart).lineNumber);
  };

  useEffect(() => {
    if (!requestedLine) return;
    moveCaretToLine(requestedLine.lineNumber, value, textareaRef, highlightRef, gutterRef, onActiveLineChange, setCursorOffset);
  }, [requestedLine, onActiveLineChange]);

  useEffect(() => {
    setSelectedSuggestion(0);
  }, [currentLinePrefix]);

  const moveToSearchMatch = (direction: 1 | -1) => {
    const query = search.trim();
    const textarea = textareaRef.current;
    if (!query || !textarea) return;

    const haystack = value.toLowerCase();
    const needle = query.toLowerCase();
    const start = direction > 0 ? textarea.selectionEnd : Math.max(0, textarea.selectionStart - 1);
    const index = direction > 0 ? haystack.indexOf(needle, start) : haystack.lastIndexOf(needle, start);
    const wrappedIndex = index >= 0 ? index : direction > 0 ? haystack.indexOf(needle) : haystack.lastIndexOf(needle);
    if (wrappedIndex < 0) return;

    textarea.focus();
    textarea.setSelectionRange(wrappedIndex, wrappedIndex + query.length);
    textarea.scrollTop = Math.max(0, getLineAtOffset(value, wrappedIndex).lineNumber - 3) * 22;
    syncScroll(textarea, highlightRef, gutterRef);
    updateCursorLine();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        onRedo();
      } else {
        onUndo();
      }
      setShowSuggest(false);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      onRedo();
      setShowSuggest(false);
      return;
    }

    if (event.ctrlKey && event.key === ' ') {
      event.preventDefault();
      setShowSuggest(canShowSuggestions(currentLinePrefix, true));
      return;
    }

    if (!showSuggest || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      applySuggestion(suggestions[selectedSuggestion], value, onChange, textareaRef);
      setShowSuggest(false);
    } else if (event.key === 'Escape') {
      setShowSuggest(false);
    }
  };

  return (
    <section className="editor-wrap">
      <div className="editor-topline">
        <div className="file-tabs" role="tablist" aria-label="Open files">
          {fileTabs.map((file) => (
            <div
              className={`file-tab ${file.id === activeFileId ? 'active' : ''}`}
              key={file.id}
              role="tab"
              tabIndex={0}
              aria-selected={file.id === activeFileId}
              onClick={() => onSelectFile(file.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectFile(file.id);
                }
              }}
              title={file.name}
            >
              <span>{file.name}</span>
              {file.isDirty ? <i className="dirty-dot" title="Unsaved changes" /> : null}
              {fileTabs.length > 1 ? (
                <button
                  className="tab-close"
                  type="button"
                  title={`Close ${file.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseFile(file.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      onCloseFile(file.id);
                    }
                  }}
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <label className="search-box">
          <Search size={15} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              moveToSearchMatch(event.shiftKey ? -1 : 1);
            }
          }} placeholder="Find" />
          <button type="button" onClick={() => moveToSearchMatch(-1)} title="Previous match">
            <ChevronUp size={14} />
          </button>
          <button type="button" onClick={() => moveToSearchMatch(1)} title="Next match">
            <ChevronDown size={14} />
          </button>
        </label>
      </div>
      <div className="code-frame">
        <div className="gutter" aria-hidden="true" ref={gutterRef}>
          {lines.map((_, index) => {
            const lineNumber = index + 1;
            const problem = problemLines.get(lineNumber);
            return (
              <div className={`gutter-line ${activeLine === lineNumber ? 'active' : ''}`} key={lineNumber}>
                <span>{lineNumber}</span>
                {problem ? <i className={`marker ${problem.severity}`} title={problem.message} /> : null}
              </div>
            );
          })}
        </div>
        <pre className="highlight-layer" aria-hidden="true" ref={highlightRef}>
          {lines.map((line, index) => (
            <span className={`code-line ${problemLines.get(index + 1)?.severity ?? ''}`} key={`${index}-${line}`}>
              {problemLines.get(index + 1) ? (
                <span className={`tok-problem ${problemLines.get(index + 1)?.severity}`}>
                  {highlightTuflowLine(line, search, index + 1)}
                </span>
              ) : (
                highlightTuflowLine(line, search, index + 1)
              )}
            </span>
          ))}
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          spellCheck={false}
          wrap="off"
          onChange={(event) => {
            onChange(event.target.value);
            setCursorOffset(event.target.selectionStart);
            const nextLine = getLineAtOffset(event.target.value, event.target.selectionStart);
            onActiveLineChange(nextLine.lineNumber);
            const nextLineText = event.target.value.split('\n')[nextLine.lineNumber - 1] ?? '';
            const nextLinePrefix = nextLineText.slice(0, nextLine.column);
            setShowSuggest(canShowSuggestions(nextLinePrefix, false));
          }}
          onClick={() => {
            updateCursorLine();
            setShowSuggest(false);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => {
            updateCursorLine();
            if (event.key === 'Escape') {
              setShowSuggest(false);
            } else if (!isTypingKey(event)) {
              setShowSuggest(false);
            }
          }}
          onFocus={() => setShowSuggest(false)}
          onScroll={(event) => {
            syncScroll(event.currentTarget, highlightRef, gutterRef);
          }}
          className="code-input"
        />
        {showSuggest && suggestions.length > 0 ? (
          <div className="suggestions" style={{ top: Math.max(42, suggestionTop), left: Math.max(72, suggestionLeft) }}>
            {suggestions.map((suggestion, index) => (
              <button className={selectedSuggestion === index ? 'active' : ''} key={`${suggestion.kind}-${suggestion.label}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                applySuggestion(suggestion, value, onChange, textareaRef);
                setShowSuggest(false);
              }}>
                <strong>{suggestion.label}</strong>
                <span>{suggestion.detail}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function canShowSuggestions(linePrefix: string, manual: boolean) {
  if (manual) return true;

  const assignmentIndex = linePrefix.indexOf('==');
  if (assignmentIndex >= 0) {
    return linePrefix.slice(assignmentIndex + 2).trim().length > 0;
  }

  return linePrefix.trim().length > 0;
}

function isTypingKey(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete';
}

function applySuggestion(suggestion: Suggestion, value: string, onChange: (value: string) => void, ref: RefObject<HTMLTextAreaElement | null>) {
  const textarea = ref.current;
  if (!textarea) return;

  const line = getLineAtOffset(value, textarea.selectionStart);
  const lineEnd = value.indexOf('\n', line.start) === -1 ? value.length : value.indexOf('\n', line.start);
  const current = value.slice(line.start, lineEnd);
  const assignmentIndex = current.indexOf('==');
  const commentMatch = suggestion.kind === 'file' ? current.slice(Math.max(0, assignmentIndex + 2)).match(/\s(?:!|#|\/\/).*/) : null;
  const replacementEnd = commentMatch?.index === undefined ? lineEnd : line.start + assignmentIndex + 2 + commentMatch.index;
  const replacementStart = suggestion.kind === 'file' && assignmentIndex >= 0 ? line.start + assignmentIndex + 2 : line.start;
  const prefix = suggestion.kind === 'file' ? ' ' : '';
  const insertText = `${prefix}${suggestion.insertText}`;
  const nextValue = `${value.slice(0, replacementStart)}${insertText}${value.slice(replacementEnd)}`;
  const nextCaret = replacementStart + insertText.length;

  onChange(nextValue);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(nextCaret, nextCaret);
  });
}

function getLineAtOffset(value: string, offset: number) {
  const safeOffset = Math.min(Math.max(offset, 0), value.length);
  const start = value.lastIndexOf('\n', Math.max(0, safeOffset - 1)) + 1;
  const lineNumber = value.slice(0, safeOffset).split('\n').length;
  return {
    lineNumber,
    column: safeOffset - start,
    start
  };
}

function moveCaretToLine(
  lineNumber: number,
  value: string,
  ref: RefObject<HTMLTextAreaElement | null>,
  highlightRef: RefObject<HTMLPreElement | null>,
  gutterRef: RefObject<HTMLDivElement | null>,
  onActiveLineChange: (line: number) => void,
  onCursorOffsetChange: (offset: number) => void
) {
  const textarea = ref.current;
  if (!textarea) return;
  const lines = value.split('\n');
  const safeLine = Math.min(Math.max(lineNumber, 1), lines.length);
  const offset = lines.slice(0, safeLine - 1).join('\n').length + (safeLine > 1 ? 1 : 0);
  textarea.focus();
  textarea.setSelectionRange(offset, offset);
  textarea.scrollTop = Math.max(0, safeLine - 3) * 22;
  syncScroll(textarea, highlightRef, gutterRef);
  onCursorOffsetChange(offset);
  onActiveLineChange(safeLine);
}

function syncScroll(textarea: HTMLTextAreaElement, highlightRef: RefObject<HTMLPreElement | null>, gutterRef: RefObject<HTMLDivElement | null>) {
  if (highlightRef.current) {
    highlightRef.current.scrollTop = textarea.scrollTop;
    highlightRef.current.scrollLeft = textarea.scrollLeft;
  }
  if (gutterRef.current) {
    gutterRef.current.scrollTop = textarea.scrollTop;
  }
}
