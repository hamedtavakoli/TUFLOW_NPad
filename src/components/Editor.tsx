import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from '@codemirror/view';
import { getAutocompleteSuggestions } from '../lib/autocomplete';
import type { Problem, ProjectInput, Suggestion } from '../lib/types';
import { parseTuflowLine } from '../tuflow/parser/tuflowParser';
import { tokenizeTuflowLine } from '../tuflow/editor/tuflowHighlighter';

interface EditorFileTab {
  id: string;
  name: string;
  isDirty: boolean;
}

interface EditorViewState {
  cursorOffset: number;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  scrollLeft: number;
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
  viewState: EditorViewState;
  onViewStateChange: (viewState: EditorViewState & { activeLine: number }) => void;
  requestedLine: { fileId: string; lineNumber: number; nonce: number } | null;
  onRequestedLineHandled: () => void;
  search: string;
  onSearchChange: (search: string) => void;
}

const problemCompartment = new Compartment();
const inputCompartment = new Compartment();
const searchCompartment = new Compartment();

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
  onActiveLineChange,
  viewState,
  onViewStateChange,
  requestedLine,
  onRequestedLineHandled,
  search,
  onSearchChange
}: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const activeFileRef = useRef(activeFileId);
  const onChangeRef = useRef(onChange);
  const onActiveLineChangeRef = useRef(onActiveLineChange);
  const onViewStateChangeRef = useRef(onViewStateChange);
  const valueRef = useRef(value);

  onChangeRef.current = onChange;
  onActiveLineChangeRef.current = onActiveLineChange;
  onViewStateChangeRef.current = onViewStateChange;
  valueRef.current = value;

  const problemLines = useMemo(() => new Map(problems.map((problem) => [problem.lineNumber, problem])), [problems]);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          tuflowSyntaxDecorations(),
          problemCompartment.of(problemDecorations(problemLines)),
          inputCompartment.of(autocompleteFromInputs(inputs)),
          searchCompartment.of(searchDecorations(search)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet || update.viewportChanged) {
              captureCodeMirrorViewState(update.view, onActiveLineChangeRef.current, onViewStateChangeRef.current);
            }
          }),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': {
              fontFamily: '"Cascadia Mono", Consolas, monospace',
              fontSize: '14px',
              lineHeight: '22px',
              overflow: 'auto'
            },
            '.cm-content': {
              padding: '12px 14px 34px'
            },
            '.cm-gutters': {
              backgroundColor: '#f0f4f7',
              color: '#718093',
              borderRight: '1px solid #d7dee5'
            },
            '.cm-activeLine': {
              backgroundColor: '#eaf5f6'
            },
            '.cm-activeLineGutter': {
              backgroundColor: '#dcecef',
              color: '#003f47',
              fontWeight: '700'
            },
            '.cm-selectionBackground': {
              backgroundColor: 'rgba(13, 137, 148, 0.22) !important'
            },
            '.cm-tooltip': {
              border: '1px solid #b8c4cf',
              borderRadius: '8px',
              boxShadow: '0 18px 40px rgba(24, 36, 50, 0.16)',
              overflow: 'hidden'
            }
          })
        ]
      })
    });

    viewRef.current = view;
    view.scrollDOM.addEventListener('scroll', () => captureCodeMirrorViewState(view, onActiveLineChangeRef.current, onViewStateChangeRef.current));
    restoreCodeMirrorViewState(view, viewState, onActiveLineChange);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || activeFileRef.current === activeFileId) return;
    activeFileRef.current = activeFileId;
    replaceDocument(view, value);
    requestAnimationFrame(() => restoreCodeMirrorViewState(view, viewState, onActiveLineChange));
  }, [activeFileId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    replaceDocument(view, value);
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: problemCompartment.reconfigure(problemDecorations(problemLines)) });
  }, [problemLines]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: inputCompartment.reconfigure(autocompleteFromInputs(inputs)) });
  }, [inputs]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: searchCompartment.reconfigure(searchDecorations(search)) });
  }, [search]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !requestedLine || requestedLine.fileId !== activeFileId) return;
    const line = view.state.doc.line(Math.min(Math.max(requestedLine.lineNumber, 1), view.state.doc.lines));
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' })
    });
    captureCodeMirrorViewState(view, onActiveLineChange, onViewStateChange);
    onRequestedLineHandled();
  }, [requestedLine?.nonce, requestedLine?.fileId, activeFileId]);

  const moveToSearchMatch = (direction: 1 | -1) => {
    const view = viewRef.current;
    const query = search.trim();
    if (!view || !query) return;

    const text = view.state.doc.toString();
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
    const selection = view.state.selection.main;
    const start = direction > 0 ? selection.to : Math.max(0, selection.from - 1);
    const index = direction > 0 ? haystack.indexOf(needle, start) : haystack.lastIndexOf(needle, start);
    const wrappedIndex = index >= 0 ? index : direction > 0 ? haystack.indexOf(needle) : haystack.lastIndexOf(needle);
    if (wrappedIndex < 0) return;

    view.focus();
    view.dispatch({
      selection: { anchor: wrappedIndex, head: wrappedIndex + query.length },
      effects: EditorView.scrollIntoView(wrappedIndex, { y: 'center' })
    });
    captureCodeMirrorViewState(view, onActiveLineChange, onViewStateChange);
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
              onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
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
      <div className="code-frame cm-code-frame" ref={hostRef} />
    </section>
  );
}

function replaceDocument(view: EditorView, value: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: value }
  });
}

function captureCodeMirrorViewState(
  view: EditorView,
  onActiveLineChange: (line: number) => void,
  onViewStateChange: (viewState: EditorViewState & { activeLine: number }) => void
) {
  const selection = view.state.selection.main;
  const activeLine = view.state.doc.lineAt(selection.head).number;
  onActiveLineChange(activeLine);
  onViewStateChange({
    activeLine,
    cursorOffset: selection.head,
    selectionStart: selection.from,
    selectionEnd: selection.to,
    scrollTop: view.scrollDOM.scrollTop,
    scrollLeft: view.scrollDOM.scrollLeft
  });
}

function restoreCodeMirrorViewState(view: EditorView, viewState: EditorViewState, onActiveLineChange: (line: number) => void) {
  const safeStart = Math.min(Math.max(viewState.selectionStart, 0), view.state.doc.length);
  const safeEnd = Math.min(Math.max(viewState.selectionEnd, safeStart), view.state.doc.length);
  view.dispatch({ selection: { anchor: safeStart, head: safeEnd } });
  view.scrollDOM.scrollTop = Math.min(Math.max(viewState.scrollTop, 0), Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight));
  view.scrollDOM.scrollLeft = Math.min(Math.max(viewState.scrollLeft, 0), Math.max(0, view.scrollDOM.scrollWidth - view.scrollDOM.clientWidth));
  onActiveLineChange(view.state.doc.lineAt(safeStart).number);
}

function autocompleteFromInputs(inputs: ProjectInput[]) {
  return autocompletion({
    activateOnTyping: true,
    override: [
      (context: CompletionContext) => {
        const line = context.state.doc.lineAt(context.pos);
        const prefix = line.text.slice(0, context.pos - line.from);
        const suggestions = getAutocompleteSuggestions(prefix, inputs);
        if (!context.explicit && suggestions.length === 0) return null;
        const from = completionStart(line.text, context.pos - line.from, suggestions);
        return {
          from: line.from + from,
          options: suggestions.map(toCompletion)
        };
      }
    ]
  });
}

function completionStart(lineText: string, column: number, suggestions: Suggestion[]) {
  const assignmentIndex = lineText.indexOf('==');
  if (assignmentIndex >= 0 && suggestions.some((suggestion) => suggestion.kind !== 'command')) {
    const afterAssignment = lineText.slice(assignmentIndex + 2, column);
    return assignmentIndex + 2 + (afterAssignment.match(/^\s*/)?.[0].length ?? 0);
  }

  const prefix = lineText.slice(0, column);
  const match = prefix.match(/[^\s]*$/);
  return column - (match?.[0].length ?? 0);
}

function toCompletion(suggestion: Suggestion): Completion {
  return {
    label: suggestion.label,
    detail: suggestion.detail,
    type: suggestion.kind === 'file' ? 'file' : suggestion.kind === 'command' ? 'keyword' : 'constant',
    apply: suggestion.insertText
  };
}

function tuflowSyntaxDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildSyntaxDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildSyntaxDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}

function buildSyntaxDecorations(view: EditorView) {
  const decorations = [];
  for (const range of view.visibleRanges) {
    let pos = range.from;
    while (pos <= range.to) {
      const line = view.state.doc.lineAt(pos);
      let tokenStart = line.from;
      const tokens = tokenizeTuflowLine(line.text, parseTuflowLine(line.text, line.number));
      for (const token of tokens) {
        const tokenEnd = tokenStart + token.text.length;
        if (token.text.trim()) {
          decorations.push(Decoration.mark({ class: `tok-${token.kind}` }).range(tokenStart, tokenEnd));
        }
        tokenStart = tokenEnd;
      }
      if (line.to >= range.to) break;
      pos = line.to + 1;
    }
  }
  return Decoration.set(decorations, true);
}

function problemDecorations(problemLines: Map<number, Problem>) {
  return EditorView.decorations.compute([], (state) => {
    const decorations = [];
    for (const problem of problemLines.values()) {
      if (problem.lineNumber < 1 || problem.lineNumber > state.doc.lines) continue;
      const line = state.doc.line(problem.lineNumber);
      decorations.push(
        Decoration.line({ class: `cm-problem-line ${problem.severity}` }).range(line.from),
        Decoration.mark({ class: `tok-problem ${problem.severity}` }).range(line.from, line.to)
      );
    }
    return Decoration.set(decorations, true);
  });
}

function searchDecorations(search: string) {
  return EditorView.decorations.compute([], (state) => {
    const query = search.trim().toLowerCase();
    if (!query) return Decoration.none;

    const decorations = [];
    const text = state.doc.toString();
    const lowerText = text.toLowerCase();
    let index = lowerText.indexOf(query);
    while (index >= 0) {
      decorations.push(Decoration.mark({ class: 'tok-search' }).range(index, index + query.length));
      index = lowerText.indexOf(query, index + query.length);
    }
    return Decoration.set(decorations, true);
  });
}
