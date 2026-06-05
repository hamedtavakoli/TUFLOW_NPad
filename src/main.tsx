import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlignLeft, Columns2, Download, FilePlus2, FolderOpen, HelpCircle, Moon, PlayCircle, Redo2, Save, Sun, Undo2 } from 'lucide-react';
import { Editor } from './components/Editor';
import { FilePanel } from './components/FilePanel';
import { ProblemsPanel } from './components/ProblemsPanel';
import { CommandHelp } from './components/CommandHelp';
import { CompareView } from './components/CompareView';
import { classifyInput } from './lib/autocomplete';
import {
  createProjectFileIndex,
  createProjectFileIndexFromDirectoryHandle,
  createProjectFileIndexFromFileList,
  defaultExcludedFolderNames,
  findProjectFileByReference,
  isReadableProjectFile,
  normaliseExcludedFolderNames,
  readableProjectFileAccept
} from './lib/projectFiles';
import { validateTuflowText } from './lib/validator';
import { formatTuflowText } from './lib/formatter';
import { getEditorLanguage, isTuflowEditorLanguage } from './lib/editorLanguage';
import { buildTuflowSymbolIndex, emptyTuflowSymbolIndex } from './lib/tuflowSymbols';
import type { ProjectFileIndex, ProjectInput } from './lib/types';
import packageJson from '../package.json';
import appIconUrl from '../assets/Image May 29, 2026, 11_25_10 PM.png';
import './styles.css';

const appVersion = packageJson.version;

const starterText = `! Welcome to TUFLOW Command Studio
! This welcome file is a guide for TCS. It is not intended to be run as a model.
! Open your own .tcf, .tgc, .tbc, .tef, .ecf, .toc, .trd, .bat, or .cmd files when you are ready.

! 1. Choose a Model Root from the Project Files panel.
!    TCS indexes readable project files and checks referenced paths against that root.
Geometry Control File == model\\M01_001.tgc
BC Control File == bc\\M01_001.tbc
Event File == events\\design_events.tef

! 2. Use autocomplete while typing commands.
!    Tab accepts the full selected suggestion.
!    ArrowRight accepts the next word of a selected suggestion.
Read GIS == gis\\2d_code_M01.shp
Read GRID == grids\\dem_5m.asc
Read Materials File == materials\\materials.tmf

! 3. Use Command Guide for the active line and Library for searchable command help.
Cell Size == 5
Timestep == 1.0
Output Folder == results\\~s1~\\~e1~\\

! 4. Check References to show missing, excluded, or variable-based file references.
!    Reference Checks in Diagnostics controls whether project file availability messages are shown.
BC Database == bc_dbase\\bc_dbase.csv

! 5. Variables can centralise values and can be reused with <<name>>.
Set Variable DEM_GRID == grids\\dem_5m.asc
Set Variable RUN_TIMESTEP == 1.0
Read GRID == <<DEM_GRID>>
Timestep == <<RUN_TIMESTEP>>

! 6. Events and scenarios are also available as variables in TUFLOW.
Model Events == 01AEP | 02AEP
Model Scenarios == 2m | 5m | 10m
If Scenario == 5m
  Set Variable GRID_SIZE == 5
Else If Scenario == 10m
  Set Variable GRID_SIZE == 10
End If

! 7. Dark mode, diagnostics, formatting, command help, and project browsing are available from the main page.
!    This file is safe to edit or close.
`;

interface OpenFileTab {
  id: string;
  name: string;
  text: string;
  savedText: string;
  activeLine: number;
  cursorOffset: number;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  scrollLeft: number;
  undoStack: string[];
  redoStack: string[];
  projectPath?: string;
}

const starterFile: OpenFileTab = {
  id: 'starter-model',
  name: 'Welcome.tcf',
  text: starterText,
  savedText: starterText,
  activeLine: 1,
  cursorOffset: 0,
  selectionStart: 0,
  selectionEnd: 0,
  scrollTop: 0,
  scrollLeft: 0,
  undoStack: [],
  redoStack: []
};

const historyLimit = 100;

interface DirectoryHandleLike {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<{ kind: 'file'; name: string } | DirectoryHandleLike>;
}

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker: () => Promise<DirectoryHandleLike>;
};

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => initialTheme());
  const [workspaceMode, setWorkspaceMode] = useState<'editor' | 'compare'>('editor');
  const [files, setFiles] = useState<OpenFileTab[]>([starterFile]);
  const [activeFileId, setActiveFileId] = useState(starterFile.id);
  const [requestedLine, setRequestedLine] = useState<{ fileId: string; lineNumber: number; nonce: number } | null>(null);
  const [diagnosticLineRequest, setDiagnosticLineRequest] = useState<{ lineNumber: number; nonce: number } | null>(null);
  const [search, setSearch] = useState('');
  const [showMissingInputProblems, setShowMissingInputProblems] = useState(false);
  const [projectFileIndex, setProjectFileIndex] = useState<ProjectFileIndex | undefined>();
  const [projectDirectoryHandle, setProjectDirectoryHandle] = useState<DirectoryHandleLike | undefined>();
  const [excludedFolderNames, setExcludedFolderNames] = useState(defaultExcludedFolderNames);
  const [lastIndexedAt, setLastIndexedAt] = useState<string | undefined>();
  const [hasRunProjectValidation, setHasRunProjectValidation] = useState(false);
  const [validationStatus, setValidationStatus] = useState('Choose a model root to check references.');

  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const text = activeFile?.text ?? '';
  const activeLine = activeFile?.activeLine ?? 1;
  const activeEditorLanguage = getEditorLanguage(activeFile?.projectPath ?? activeFile?.name ?? '');
  const isActiveTuflowFile = isTuflowEditorLanguage(activeEditorLanguage);
  const hasUnsavedFiles = files.some((file) => file.text !== file.savedText);
  const availabilityIndex = useMemo(
    () =>
      projectFileIndex
        ? createProjectFileIndex(projectFileIndex.rootName, [
            ...projectFileIndex.files.map((file) => file.path),
            ...files.map((file) => file.name)
          ], {
            folders: projectFileIndex.folders.map((folder) => folder.path),
            excludedFolderNames,
            sources: projectFileSources(projectFileIndex)
          })
        : undefined,
    [excludedFolderNames, files, projectFileIndex]
  );
  const projectInputs = useMemo(() => projectInputsFromIndex(availabilityIndex, files), [availabilityIndex, files]);
  const tuflowSymbols = useMemo(
    () => (isActiveTuflowFile ? buildTuflowSymbolIndex(text) : emptyTuflowSymbolIndex),
    [isActiveTuflowFile, text]
  );
  const allProblems = useMemo(
    () =>
      isActiveTuflowFile
        ? validateTuflowText(text, projectInputs, {
            checkProjectFiles: hasRunProjectValidation,
            projectFileIndex: availabilityIndex,
            symbols: tuflowSymbols
          })
        : [],
    [availabilityIndex, hasRunProjectValidation, isActiveTuflowFile, projectInputs, text, tuflowSymbols]
  );
  const problems = useMemo(
    () => (showMissingInputProblems ? allProblems : allProblems.filter((problem) => !problem.id.startsWith('missing-input'))),
    [allProblems, showMissingInputProblems]
  );

  useEffect(() => {
    if (!hasRunProjectValidation) return;
    const fileProblems = allProblems.filter((problem) => /^(missing-input|uncheckable-input)-/.test(problem.id));
    setValidationStatus(fileProblems.length === 0 ? 'All references found.' : `${fileProblems.length} reference issue${fileProblems.length === 1 ? '' : 's'} found.`);
  }, [allProblems, hasRunProjectValidation]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('tcs-theme', theme);
  }, [theme]);

  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement('link');
    icon.rel = 'icon';
    icon.href = appIconUrl;
    document.head.appendChild(icon);
  }, []);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedFiles) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedFiles]);

  const setActiveText = (nextText: string) => {
    updateActiveText(nextText, true);
  };

  const updateActiveText = (nextText: string, recordHistory: boolean) => {
    setFiles((current) =>
      current.map((file) => {
        if (file.id !== activeFile.id || file.text === nextText) return file;
        return {
          ...file,
          text: nextText,
          undoStack: recordHistory ? [...file.undoStack.slice(-(historyLimit - 1)), file.text] : file.undoStack,
          redoStack: recordHistory ? [] : file.redoStack
        };
      })
    );
  };

  const undo = () => {
    setFiles((current) =>
      current.map((file) => {
        if (file.id !== activeFile.id || file.undoStack.length === 0) return file;
        const previousText = file.undoStack.at(-1) ?? file.text;
        return {
          ...file,
          text: previousText,
          undoStack: file.undoStack.slice(0, -1),
          redoStack: [...file.redoStack.slice(-(historyLimit - 1)), file.text]
        };
      })
    );
  };

  const redo = () => {
    setFiles((current) =>
      current.map((file) => {
        if (file.id !== activeFile.id || file.redoStack.length === 0) return file;
        const nextText = file.redoStack.at(-1) ?? file.text;
        return {
          ...file,
          text: nextText,
          undoStack: [...file.undoStack.slice(-(historyLimit - 1)), file.text],
          redoStack: file.redoStack.slice(0, -1)
        };
      })
    );
  };

  const selectFile = (id: string) => {
    setActiveFileId(id);
    setRequestedLine(null);
    setHasRunProjectValidation(false);
    setValidationStatus(projectFileIndex ? 'Ready to check references.' : 'Choose a model root to check references.');
  };

  const closeFile = (id: string) => {
    const fileToClose = files.find((file) => file.id === id);
    if (fileToClose && fileToClose.text !== fileToClose.savedText && !window.confirm(`Discard unsaved changes to "${fileToClose.name}"?`)) {
      return;
    }

    if (files.length === 1) return;

    const closingIndex = files.findIndex((file) => file.id === id);
    const nextFiles = files.filter((file) => file.id !== id);
    const nextActiveId =
      id === activeFileId ? nextFiles[Math.min(Math.max(closingIndex, 0), nextFiles.length - 1)]?.id ?? nextFiles[0].id : activeFileId;

    setFiles(nextFiles);
    setActiveFileId(nextActiveId);
    setRequestedLine(null);
  };

  const newFile = () => {
    const nextFile: OpenFileTab = {
      id: `new-${crypto.randomUUID()}`,
      name: `untitled-${files.length + 1}.tcf`,
      text: '! New TUFLOW control file\n',
      savedText: '',
      activeLine: 1,
      cursorOffset: 0,
      selectionStart: 0,
      selectionEnd: 0,
      scrollTop: 0,
      scrollLeft: 0,
      undoStack: [],
      redoStack: []
    };
    setFiles((current) => [...current, nextFile]);
    selectFile(nextFile.id);
  };

  const saveFile = () => {
    downloadText(activeFile.name, text);
    setFiles((current) => current.map((file) => (file.id === activeFile.id ? { ...file, savedText: file.text } : file)));
  };
  const exportProblems = () => downloadText(`${stripExtension(activeFile.name)}-diagnostics.json`, JSON.stringify(problems, null, 2));
  const validateActiveFile = async () => {
    if (!isActiveTuflowFile) {
      setHasRunProjectValidation(false);
      setShowMissingInputProblems(false);
      setValidationStatus('TUFLOW validation is available for control files.');
      return;
    }

    const index = availabilityIndex ?? await chooseProjectRoot();
    if (!index) {
      setValidationStatus('Model root is required for reference checks.');
      return;
    }

    const validationProblems = validateTuflowText(text, projectInputs, {
      checkProjectFiles: true,
      projectFileIndex: index,
      symbols: tuflowSymbols
    });
    const fileProblems = validationProblems.filter((problem) => /^(missing-input|uncheckable-input)-/.test(problem.id));

    setHasRunProjectValidation(true);
    setShowMissingInputProblems(true);
    setValidationStatus(fileProblems.length === 0 ? 'All references found.' : `${fileProblems.length} reference issue${fileProblems.length === 1 ? '' : 's'} found.`);

    const firstProblem = fileProblems[0] ?? validationProblems[0];
    if (firstProblem) {
      goToLine(firstProblem.lineNumber);
    }
  };
  const goToLine = (line: number) => {
    setActiveLineForFile(activeFile.id, line);
    setRequestedLine({ fileId: activeFile.id, lineNumber: line, nonce: Date.now() });
  };

  const chooseProjectRoot = async (): Promise<ProjectFileIndex | undefined> => {
    if (!('showDirectoryPicker' in window)) {
      window.alert('Use Choose Root in Project Files to select a model root folder.');
      return undefined;
    }

    try {
      const handle = await (window as WindowWithDirectoryPicker).showDirectoryPicker();
      const index = await createProjectFileIndexFromDirectoryHandle(handle, excludedFolderNames);
      const nextIndex = withOpenTabs(index, files);
      setProjectFileIndex(index);
      setProjectDirectoryHandle(handle);
      setLastIndexedAt(formatTime(new Date()));
      setHasRunProjectValidation(false);
      setValidationStatus(`${index.rootName} indexed with ${index.files.length} files.`);
      return nextIndex;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setValidationStatus('Model root selection failed.');
      }
      return undefined;
    }
  };

  const registerProjectRootFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const index = createProjectFileIndexFromFileList(fileList, excludedFolderNames);
    setProjectFileIndex(index);
    setProjectDirectoryHandle(undefined);
    setLastIndexedAt(formatTime(new Date()));
    setHasRunProjectValidation(false);
    setValidationStatus(`${index.rootName} indexed with ${index.files.length} files.`);
  };

  const openProjectFile = async (path: string) => {
    const existing = files.find((file) => sameProjectPath(file.projectPath ?? file.name, path));
    if (existing) {
      selectFile(existing.id);
      return;
    }

    const projectFile = projectFileIndex?.files.find((file) => sameProjectPath(file.path, path));
    if (!projectFile || !isReadableProjectFile(projectFile) || !projectFile.source) {
      setValidationStatus('File content unavailable. Select the project root again or choose a readable text file.');
      return;
    }

    const sourceFile = projectFile.source.kind === 'file' ? projectFile.source.file : await projectFile.source.handle.getFile();
    const nextText = normaliseEditorText(await sourceFile.text());
    const nextFile: OpenFileTab = {
      id: `${projectFile.path}-${sourceFile.lastModified}-${sourceFile.size}-${crypto.randomUUID()}`,
      name: projectFile.name,
      text: nextText,
      savedText: nextText,
      activeLine: 1,
      cursorOffset: 0,
      selectionStart: 0,
      selectionEnd: 0,
      scrollTop: 0,
      scrollLeft: 0,
      undoStack: [],
      redoStack: [],
      projectPath: projectFile.path
    };

    setFiles((current) => [...current, nextFile]);
    selectFile(nextFile.id);
  };

  const openReferencedFile = async (reference: string) => {
    const existing = files.find((file) => sameProjectPath(file.projectPath ?? file.name, reference));
    if (existing) {
      selectFile(existing.id);
      return;
    }

    if (!projectFileIndex) {
      setValidationStatus('Choose a model root before opening referenced files.');
      return;
    }

    const projectFile = findProjectFileByReference(reference, projectFileIndex);
    if (!projectFile) {
      setValidationStatus(`Referenced file "${reference}" was not found, is excluded, or is ambiguous.`);
      return;
    }
    if (!isReadableProjectFile(projectFile)) {
      setValidationStatus(`Referenced file "${projectFile.name}" is not a readable text file.`);
      return;
    }
    if (!projectFile.source) {
      setValidationStatus('File content unavailable. Select the project root again or choose a readable text file.');
      return;
    }

    await openProjectFile(projectFile.path);
  };

  const refreshProjectRoot = async () => {
    if (!projectDirectoryHandle) {
      await chooseProjectRoot();
      return;
    }

    try {
      const index = await createProjectFileIndexFromDirectoryHandle(projectDirectoryHandle, excludedFolderNames);
      setProjectFileIndex(index);
      setLastIndexedAt(formatTime(new Date()));
      setHasRunProjectValidation(false);
      setValidationStatus(`${index.rootName} refreshed with ${index.files.length} files.`);
    } catch {
      setValidationStatus('Model root refresh failed. Choose the root again.');
    }
  };

  const addExcludedFolder = (name: string) => {
    const nextNames = normaliseExcludedFolderNames([...excludedFolderNames, name]);
    setExcludedFolderNames(nextNames);
    setProjectFileIndex((current) => current ? createProjectFileIndex(current.rootName, current.files.map((file) => file.path), {
      folders: current.folders.map((folder) => folder.path),
      excludedFolderNames: nextNames,
      sources: projectFileSources(current)
    }) : current);
    setHasRunProjectValidation(false);
    setValidationStatus('Exclusions updated. Refresh project index for folder scan changes.');
  };

  const removeExcludedFolder = (name: string) => {
    const nextNames = normaliseExcludedFolderNames(excludedFolderNames.filter((folderName) => folderName !== name));
    setExcludedFolderNames(nextNames);
    setProjectFileIndex((current) => current ? createProjectFileIndex(current.rootName, current.files.map((file) => file.path), {
      folders: current.folders.map((folder) => folder.path),
      excludedFolderNames: nextNames,
      sources: projectFileSources(current)
    }) : current);
    setHasRunProjectValidation(false);
    setValidationStatus('Exclusions updated. Refresh project index for folder scan changes.');
  };

  const setActiveLineForFile = (fileId: string, line: number) => {
    setFiles((current) => current.map((file) => (file.id === fileId ? { ...file, activeLine: line } : file)));
  };

  const setViewStateForFile = (
    fileId: string,
    viewState: Pick<OpenFileTab, 'activeLine' | 'cursorOffset' | 'selectionStart' | 'selectionEnd' | 'scrollTop' | 'scrollLeft'>
  ) => {
    setFiles((current) =>
      current.map((file) => {
        if (file.id !== fileId) return file;
        const next = {
          ...file,
          ...viewState
        };
        return file.activeLine === next.activeLine &&
          file.cursorOffset === next.cursorOffset &&
          file.selectionStart === next.selectionStart &&
          file.selectionEnd === next.selectionEnd &&
          file.scrollTop === next.scrollTop &&
          file.scrollLeft === next.scrollLeft
          ? file
          : next;
      })
    );
  };

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark">
            <img src={appIconUrl} alt="" />
          </span>
          <div>
            <div className="brand-title">
              <h1>TUFLOW Command Studio</h1>
              <span className="version-badge">v{appVersion}</span>
            </div>
            <p>TCS control file editor</p>
          </div>
        </div>
        <div className="toolbar-actions">
          <div className="toolbar-group">
            <button type="button" onClick={newFile} title="New file">
              <FilePlus2 size={16} />
              New
            </button>
            <label className="button-like" title="Open files">
              <FolderOpen size={16} />
              Open
              <input type="file" multiple accept={readableProjectFileAccept} onChange={(event) => openFiles(event, setFiles, selectFile)} />
            </label>
            <button type="button" onClick={saveFile} title="Save active file">
              <Save size={16} />
              Save
            </button>
            <a className="button-like" href={`${import.meta.env.BASE_URL}help.html`} target="_blank" rel="noreferrer" title="Open help page">
              <HelpCircle size={16} />
              Help
            </a>
          </div>
          <div className="toolbar-group compact">
            <button
              type="button"
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
              aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button type="button" onClick={undo} title="Undo" aria-label="Undo" disabled={activeFile.undoStack.length === 0}>
              <Undo2 size={16} />
            </button>
            <button type="button" onClick={redo} title="Redo" aria-label="Redo" disabled={activeFile.redoStack.length === 0}>
              <Redo2 size={16} />
            </button>
          </div>
          <div className="toolbar-group">
            <button
              type="button"
              onClick={() => setWorkspaceMode((current) => current === 'compare' ? 'editor' : 'compare')}
              title={workspaceMode === 'compare' ? 'Back to editor' : 'Compare open files'}
            >
              <Columns2 size={16} />
              {workspaceMode === 'compare' ? 'Editor' : 'Compare'}
            </button>
            <button type="button" className="primary-action" onClick={validateActiveFile} title="Check referenced files">
              <PlayCircle size={16} />
              Check References
            </button>
            <button type="button" onClick={() => updateActiveText(formatTuflowText(text), true)} title="Format file" disabled={!isActiveTuflowFile}>
              <AlignLeft size={16} />
              Format File
            </button>
            <button type="button" onClick={exportProblems} title="Export diagnostics">
              <Download size={16} />
              Export
            </button>
          </div>
          <span className="validation-status" title={validationStatus}>{validationStatus}</span>
        </div>
      </header>

      <main className="workspace">
        <CommandHelp activeLine={activeLine} text={text} isEnabled={isActiveTuflowFile} />
        <section className="editor-column">
          {workspaceMode === 'editor' ? (
            <Editor
              value={text}
              onChange={setActiveText}
              fileTabs={files.map(({ id, name, savedText, text }) => ({ id, name, isDirty: text !== savedText }))}
              activeFileId={activeFile.id}
              onSelectFile={selectFile}
              onCloseFile={closeFile}
              onUndo={undo}
              onRedo={redo}
              inputs={projectInputs}
              symbols={tuflowSymbols}
              problems={problems}
              editorLanguage={activeEditorLanguage}
              activeLine={activeLine}
              onActiveLineChange={(line) => setActiveLineForFile(activeFile.id, line)}
              onProblemLineSelect={(lineNumber) => setDiagnosticLineRequest({ lineNumber, nonce: Date.now() })}
              onOpenReferencedFile={openReferencedFile}
              viewState={{
                cursorOffset: activeFile.cursorOffset,
                selectionStart: activeFile.selectionStart,
                selectionEnd: activeFile.selectionEnd,
                scrollTop: activeFile.scrollTop,
                scrollLeft: activeFile.scrollLeft
              }}
              onViewStateChange={(viewState) => setViewStateForFile(activeFile.id, viewState)}
              requestedLine={requestedLine}
              onRequestedLineHandled={() => setRequestedLine(null)}
              search={search}
              onSearchChange={setSearch}
            />
          ) : (
            <CompareView
              files={files.map(({ id, name, text }) => ({ id, name, text }))}
              onBackToEditor={() => setWorkspaceMode('editor')}
            />
          )}
        </section>
        <FilePanel
          projectFileIndex={projectFileIndex}
          projectRootName={projectFileIndex?.rootName}
          projectFileCount={projectFileIndex?.files.length ?? 0}
          lastIndexedAt={lastIndexedAt}
          validationStatus={validationStatus}
          excludedFolderNames={projectFileIndex?.excludedFolderNames ?? excludedFolderNames}
          onChooseProjectRoot={chooseProjectRoot}
          onRefreshProjectRoot={refreshProjectRoot}
          onRegisterProjectRootFiles={registerProjectRootFiles}
          onAddExcludedFolder={addExcludedFolder}
          onRemoveExcludedFolder={removeExcludedFolder}
          openProjectPaths={files.map((file) => file.projectPath ?? file.name)}
          onOpenProjectFile={openProjectFile}
        />
        <ProblemsPanel
          problems={problems}
          activeLine={activeLine}
          selectedLineRequest={diagnosticLineRequest}
          showMissingInputProblems={showMissingInputProblems}
          onShowMissingInputProblemsChange={setShowMissingInputProblems}
          onSelectLine={goToLine}
        />
      </main>
    </div>
  );
}

function withOpenTabs(index: ProjectFileIndex, files: OpenFileTab[]): ProjectFileIndex {
  return createProjectFileIndex(index.rootName, [
    ...index.files.map((file) => file.path),
    ...files.map((file) => file.name)
  ], {
    folders: index.folders.map((folder) => folder.path),
    excludedFolderNames: index.excludedFolderNames,
    sources: projectFileSources(index)
  });
}

function projectFileSources(index: ProjectFileIndex): Map<string, ProjectFileIndex['files'][number]['source']> {
  return new Map(
    index.files
      .filter((file) => file.source)
      .map((file) => [file.path.toLowerCase(), file.source])
  );
}

function projectInputsFromIndex(index: ProjectFileIndex | undefined, files: OpenFileTab[]): ProjectInput[] {
  const seen = new Set<string>();
  return [
    ...(index?.files.map((file) => file.path) ?? []),
    ...files.map((file) => file.name)
  ].flatMap((path) => {
    const key = path.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    const name = path.split(/[\\/]/).at(-1) ?? path;
    return classifyInput(name, path);
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sameProjectPath(left: string, right: string): boolean {
  return left.replaceAll('/', '\\').toLowerCase() === right.replaceAll('/', '\\').toLowerCase();
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function openFiles(
  event: React.ChangeEvent<HTMLInputElement>,
  setFiles: React.Dispatch<React.SetStateAction<OpenFileTab[]>>,
  selectFile: (id: string) => void
) {
  const selectedFiles = Array.from(event.target.files ?? []);
  if (selectedFiles.length === 0) return;

  const openedFiles = await Promise.all(selectedFiles.map(readEditorFile));
  setFiles((current) => [...current, ...openedFiles]);
  selectFile(openedFiles[0].id);
  event.target.value = '';
}

async function readEditorFile(file: File): Promise<OpenFileTab> {
  const text = normaliseEditorText(await file.text());
  return {
    id: `${file.name}-${file.lastModified}-${file.size}-${crypto.randomUUID()}`,
    name: file.name,
    text,
    savedText: text,
    activeLine: 1,
    cursorOffset: 0,
    selectionStart: 0,
    selectionEnd: 0,
    scrollTop: 0,
    scrollLeft: 0,
    undoStack: [],
    redoStack: [],
    projectPath: file.webkitRelativePath ? file.webkitRelativePath.replaceAll('/', '\\') : undefined
  };
}

function normaliseEditorText(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function stripExtension(filename: string) {
  const index = filename.lastIndexOf('.');
  return index > 0 ? filename.slice(0, index) : filename;
}

function initialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('tcs-theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
