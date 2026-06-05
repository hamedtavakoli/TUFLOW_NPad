import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import {
  acceptCompletion,
  autocompletion,
  insertCompletionText,
  selectedCompletion,
  startCompletion,
  type Completion,
  type CompletionContext
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
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
import { tokenizeSyntaxLine } from '../lib/syntaxHighlight';
import type { Problem, ProjectInput, Suggestion } from '../lib/types';
import type { TuflowSymbolIndex } from '../lib/tuflowSymbols';

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
  symbols?: TuflowSymbolIndex;
  problems: Problem[];
  editorLanguage: EditorLanguage;
  activeLine: number;
  onActiveLineChange: (line: number) => void;
  onProblemLineSelect: (line: number) => void;
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
  symbols,
  problems,
  editorLanguage,
  onActiveLineChange,
  onProblemLineSelect,
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
  const onProblemLineSelectRef = useRef(onProblemLineSelect);
  const onViewStateChangeRef = useRef(onViewStateChange);
  const editorLanguageRef = useRef(editorLanguage);
  const valueRef = useRef(value);

  onChangeRef.current = onChange;
  onActiveLineChangeRef.current = onActiveLineChange;
  onProblemLineSelectRef.current = onProblemLineSelect;
  onViewStateChangeRef.current = onViewStateChange;
  editorLanguageRef.current = editorLanguage;
  valueRef.current = value;

  const problemLines = useMemo(() => new Map(problems.map((problem) => [problem.lineNumber, problem])), [problems]);
  const problemLinesRef = useRef(problemLines);
  problemLinesRef.current = problemLines;

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
          inputCompartment.of(autocompleteFromInputs(editorLanguage, inputs, symbols)),
          searchCompartment.of(searchDecorations(search)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
              maybeStartValueCompletion(update, editorLanguageRef.current);
            }
            if (update.docChanged || update.selectionSet || update.viewportChanged) {
              captureCodeMirrorViewState(update.view, onActiveLineChangeRef.current, onViewStateChangeRef.current);
            }
          }),
          EditorView.domEventHandlers({
            click: (event, view) => {
              if (editorLanguageRef.current !== 'tuflow') return false;
              const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
              if (pos === null) return false;
              const line = view.state.doc.lineAt(pos);
              if (problemLinesRef.current.has(line.number)) {
                onProblemLineSelectRef.current(line.number);
              }
              return false;
            }
          }),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': {
              fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace',
              fontSize: '12px',
              lineHeight: '1.65',
              overflow: 'auto'
            },
            '.cm-content': {
              padding: '12px 14px 34px'
            },
            '.cm-gutters': {
              backgroundColor: '#f0f4f7',
              color: '#718093',
              borderRight: '0.5px solid #d7dee5'
            },
            '.cm-activeLine': {
              backgroundColor: 'rgba(15, 118, 110, 0.06)'
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
              border: '0.5px solid #b8c4cf',
              borderRadius: '6px',
              boxShadow: 'none',
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
    view.dispatch({ effects: inputCompartment.reconfigure(autocompleteFromInputs(editorLanguage, inputs, symbols)) });
  }, [editorLanguage, inputs, symbols]);

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

function autocompleteFromInputs(editorLanguage: EditorLanguage, inputs: ProjectInput[], symbols?: TuflowSymbolIndex): Extension {
  if (editorLanguage !== 'tuflow') return [];

  return [
    Prec.highest(keymap.of([
      { key: 'Tab', run: acceptFullCompletion },
      { key: 'ArrowRight', run: acceptCompletionWord(inputs, symbols) }
    ])),
    autocompletion({
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
          const suggestions = getAutocompleteSuggestions(prefix, inputs, symbols);
          if (!context.explicit && suggestions.length === 0) return null;
          const from = completionStart(line.text, context.pos - line.from, suggestions);
          return {
            from: line.from + from,
            options: suggestions.map(toCompletion)
          };
        }
      ]
    })
  ];
}

function syntaxDecorations(editorLanguage: EditorLanguage): Extension {
  if (editorLanguage === 'tuflow' || editorLanguage === 'batch') return lineSyntaxDecorations(editorLanguage);
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

function acceptFullCompletion(view: EditorView): boolean {
  const completion = selectedCompletion(view.state);
  if (!completion) return false;

  const completionText = completionInsertText(completion);
  const shouldRestart = shouldRestartCompletionAfterInsert(completionText);
  const accepted = acceptCompletion(view);
  if (accepted && shouldRestart) {
    restartCompletion(view);
  }
  return accepted;
}

function acceptCompletionWord(inputs: ProjectInput[], symbols?: TuflowSymbolIndex) {
  return (view: EditorView): boolean => {
    const completion = selectedCompletion(view.state);
    if (!completion) return false;

    const selection = view.state.selection.main;
    if (!selection.empty) return false;

    const line = view.state.doc.lineAt(selection.head);
    const column = selection.head - line.from;
    const prefix = line.text.slice(0, column);
    const suggestions = getAutocompleteSuggestions(prefix, inputs, symbols);
    if (suggestions.length === 0) return false;

    const from = line.from + completionStart(line.text, column, suggestions);
    const current = view.state.doc.sliceString(from, selection.head);
    const completionText = completionInsertText(completion);
    const nextText = nextCompletionWord(completionText, current);
    if (!nextText || nextText.toLowerCase() === current.toLowerCase()) {
      return acceptCompletion(view);
    }

    view.dispatch({
      ...insertCompletionText(view.state, nextText, from, selection.head),
      userEvent: 'input.complete'
    });
    restartCompletion(view);
    return true;
  };
}

function completionInsertText(completion: Completion): string {
  return typeof completion.apply === 'string' ? completion.apply : completion.label;
}

function nextCompletionWord(completionText: string, currentText: string): string | undefined {
  if (!completionText) return undefined;
  const currentLength = completionText.toLowerCase().startsWith(currentText.toLowerCase()) ? currentText.length : 0;
  if (currentLength >= completionText.length) return undefined;

  const nextSpace = completionText.indexOf(' ', Math.max(currentLength, 0));
  if (nextSpace < 0) return completionText;
  return completionText.slice(0, Math.min(nextSpace + 1, completionText.length));
}

function shouldRestartCompletionAfterInsert(text: string): boolean {
  return text.endsWith('== ');
}

function restartCompletion(view: EditorView) {
  requestAnimationFrame(() => startCompletion(view));
}

function maybeStartValueCompletion(update: ViewUpdate, editorLanguage: EditorLanguage) {
  if (editorLanguage !== 'tuflow') return;
  if (!update.transactions.some((transaction) => transaction.isUserEvent('input.type'))) return;

  const selection = update.state.selection.main;
  if (!selection.empty) return;

  const line = update.state.doc.lineAt(selection.head);
  const prefix = line.text.slice(0, selection.head - line.from);
  if (/(?:^|\s)==\s*$/.test(prefix)) {
    restartCompletion(update.view);
  }
}

function lineSyntaxDecorations(editorLanguage: EditorLanguage) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildSyntaxDecorations(view, editorLanguage);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildSyntaxDecorations(update.view, editorLanguage);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}

function buildSyntaxDecorations(view: EditorView, editorLanguage: EditorLanguage) {
  const decorations = [];
  for (const range of view.visibleRanges) {
    let pos = range.from;
    while (pos <= range.to) {
      const line = view.state.doc.lineAt(pos);
      let tokenStart = line.from;
      const tokens = tokenizeSyntaxLine(line.text, editorLanguage, line.number);
      for (const token of tokens) {
        const tokenEnd = tokenStart + token.text.length;
        if (token.text.trim()) {
          decorations.push(Decoration.mark({ class: token.className }).range(tokenStart, tokenEnd));
        }
        tokenStart = tokenEnd;
      }
      if (line.to >= range.to) break;
      pos = line.to + 1;
    }
  }
  return Decoration.set(decorations, true);
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
