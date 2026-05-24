import { useMemo, useRef, useState, type RefObject } from 'react';
import { Search } from 'lucide-react';
import { getAutocompleteSuggestions } from '../lib/autocomplete';
import type { Problem, ProjectInput, Suggestion } from '../lib/types';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  inputs: ProjectInput[];
  problems: Problem[];
  activeLine: number;
  onActiveLineChange: (line: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function Editor({ value, onChange, inputs, problems, activeLine, onActiveLineChange, search, onSearchChange }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const lines = value.split('\n');
  const currentLineText = lines[activeLine - 1] ?? '';
  const suggestions = useMemo(() => getAutocompleteSuggestions(currentLineText, inputs).slice(0, 8), [currentLineText, inputs]);
  const problemLines = new Map(problems.map((problem) => [problem.lineNumber, problem]));

  const updateCursorLine = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const line = value.slice(0, textarea.selectionStart).split('\n').length;
    onActiveLineChange(line);
  };

  return (
    <section className="editor-wrap">
      <div className="editor-topline">
        <div className="file-tab">model.tcf</div>
        <label className="search-box">
          <Search size={15} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Find" />
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
            <span className="code-line" key={`${index}-${line}`}>
              {highlightLine(line, search)}
              {'\n'}
            </span>
          ))}
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onClick={updateCursorLine}
          onKeyUp={(event) => {
            updateCursorLine();
            setShowSuggest(!['Escape', 'ArrowUp', 'ArrowDown'].includes(event.key));
          }}
          onFocus={() => setShowSuggest(true)}
          onScroll={(event) => {
            if (highlightRef.current) {
              highlightRef.current.scrollTop = event.currentTarget.scrollTop;
              highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
            if (gutterRef.current) {
              gutterRef.current.scrollTop = event.currentTarget.scrollTop;
            }
          }}
          className="code-input"
        />
        {showSuggest && suggestions.length > 0 ? (
          <div className="suggestions">
            {suggestions.map((suggestion) => (
              <button key={`${suggestion.kind}-${suggestion.label}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion(suggestion, value, activeLine, onChange, textareaRef)}>
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

function applySuggestion(suggestion: Suggestion, value: string, activeLine: number, onChange: (value: string) => void, ref: RefObject<HTMLTextAreaElement>) {
  const lines = value.split('\n');
  const current = lines[activeLine - 1] ?? '';
  if (suggestion.kind === 'file' && current.includes('==')) {
    lines[activeLine - 1] = `${current.slice(0, current.indexOf('==') + 2)} ${suggestion.insertText}`;
  } else {
    lines[activeLine - 1] = suggestion.insertText;
  }
  const nextValue = lines.join('\n');
  onChange(nextValue);
  requestAnimationFrame(() => {
    ref.current?.focus();
  });
}

function highlightLine(line: string, search: string) {
  if (/^\s*(!|#|\/\/)/.test(line)) {
    return <span className="tok-comment">{line || ' '}</span>;
  }

  const assignmentIndex = line.indexOf('==');
  const content =
    assignmentIndex >= 0 ? (
      <>
        <span className="tok-command">{line.slice(0, assignmentIndex)}</span>
        <span className="tok-assign">==</span>
        <span className="tok-param">{line.slice(assignmentIndex + 2)}</span>
      </>
    ) : (
      <span className="tok-command">{line || ' '}</span>
    );

  if (!search.trim() || !line.toLowerCase().includes(search.toLowerCase())) {
    return content;
  }

  return <span className="tok-search">{content}</span>;
}
