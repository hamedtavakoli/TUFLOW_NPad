import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
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
import { completionStart } from '../lib/completionRange';
import type { EditorLanguage } from '../lib/editorLanguage';
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

type TuflowCompletion = Completion & {
  summary?: string;
};

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
  editorLanguage: EditorLanguage;
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
const syntaxCompartment = new Compartment();

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
  editorLanguage,
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
          syntaxCompartment.of(syntaxDecorations(editorLanguage)),
          problemCompartment.of(problemDecorations(editorLanguage, problemLines)),
          inputCompartment.of(autocompleteFromInputs(editorLanguage, inputs)),
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
    view.dispatch({ effects: problemCompartment.reconfigure(problemDecorations(editorLanguage, problemLines)) });
  }, [editorLanguage, problemLines]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: inputCompartment.reconfigure(autocompleteFromInputs(editorLanguage, inputs)) });
  }, [editorLanguage, inputs]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: syntaxCompartment.reconfigure(syntaxDecorations(editorLanguage)) });
  }, [editorLanguage]);

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

function autocompleteFromInputs(editorLanguage: EditorLanguage, inputs: ProjectInput[]): Extension {
  if (editorLanguage !== 'tuflow') return [];

  return autocompletion({
    activateOnTyping: true,
    addToOptions: [
      {
        render: (completion) => renderCommandCompletionSummary(completion),
        position: 85
      }
    ],
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

function syntaxDecorations(editorLanguage: EditorLanguage): Extension {
  if (editorLanguage === 'tuflow') return tuflowSyntaxDecorations();
  if (editorLanguage === 'batch') return batchSyntaxDecorations();
  return [];
}

function toCompletion(suggestion: Suggestion): Completion {
  const completion: TuflowCompletion = {
    label: suggestion.label,
    detail: suggestion.kind === 'command' ? suggestion.syntaxSuffix : suggestion.detail,
    type: suggestion.kind === 'file' ? 'file' : suggestion.kind === 'command' ? 'keyword tuflow-command' : 'constant',
    apply: suggestion.insertText,
    summary: suggestion.kind === 'command' ? suggestion.summary : undefined
  };
  return completion;
}

function renderCommandCompletionSummary(completion: Completion): HTMLElement | null {
  if (!completion.type?.includes('tuflow-command')) {
    return null;
  }

  const tuflowCompletion = completion as TuflowCompletion;
  if (!tuflowCompletion.summary) return null;

  const summary = document.createElement('span');
  summary.className = 'cm-tuflow-completion-summary';
  summary.textContent = tuflowCompletion.summary;
  return summary;
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

function batchSyntaxDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildBatchSyntaxDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildBatchSyntaxDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}

function buildBatchSyntaxDecorations(view: EditorView) {
  const decorations = [];
  const tokenPattern =
    /"[^"]*"|%[^%\s]+%|![^!\s]+!|\b(?:assoc|call|cd|choice|cls|copy|del|dir|do|echo|else|endlocal|erase|errorlevel|exist|exit|for|goto|if|in|mkdir|move|not|pause|popd|pushd|rem|ren|rmdir|robocopy|set|setlocal|shift|start|timeout|title|xcopy)\b|&&|\|\||[|&<>]/gi;

  for (const range of view.visibleRanges) {
    let pos = range.from;
    while (pos <= range.to) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      const trimmedStart = text.search(/\S/);
      const trimmed = trimmedStart >= 0 ? text.slice(trimmedStart) : '';

      if (/^(?:::|rem\b)/i.test(trimmed)) {
        decorations.push(Decoration.mark({ class: 'tok-batch-comment' }).range(line.from + trimmedStart, line.to));
      } else {
        const label = trimmed.match(/^:[^\s]+/);
        if (label && trimmedStart >= 0) {
          decorations.push(Decoration.mark({ class: 'tok-batch-label' }).range(line.from + trimmedStart, line.from + trimmedStart + label[0].length));
        }

        for (const match of text.matchAll(tokenPattern)) {
          const token = match[0];
          const start = line.from + (match.index ?? 0);
          const end = start + token.length;
          const className = batchTokenClass(token);
          if (className) {
            decorations.push(Decoration.mark({ class: className }).range(start, end));
          }
        }
      }

      if (line.to >= range.to) break;
      pos = line.to + 1;
    }
  }

  return Decoration.set(decorations, true);
}

function batchTokenClass(token: string): string | undefined {
  if (/^"/.test(token)) return 'tok-batch-string';
  if (/^%|^!/.test(token)) return 'tok-batch-variable';
  if (/^(?:&&|\|\||[|&<>])$/.test(token)) return 'tok-batch-operator';
  return 'tok-batch-keyword';
}

function problemDecorations(editorLanguage: EditorLanguage, problemLines: Map<number, Problem>): Extension {
  if (editorLanguage !== 'tuflow') return [];

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
