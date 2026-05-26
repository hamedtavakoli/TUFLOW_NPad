import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlignLeft, Download, FilePlus2, FolderOpen, PlayCircle, Redo2, Save, Undo2 } from 'lucide-react';
import { Editor } from './components/Editor';
import { FilePanel } from './components/FilePanel';
import { ProblemsPanel } from './components/ProblemsPanel';
import { CommandHelp } from './components/CommandHelp';
import { classifyInput } from './lib/autocomplete';
import { validateTuflowText } from './lib/validator';
import { formatTuflowText } from './lib/formatter';
import type { ProjectInput } from './lib/types';
import './styles.css';

const starterText = `! TUFLOW NPad starter control file
Geometry Control File == model\\M01_001.tgc
BC Control File == bc\\M01_001.tbc
Event File == events\\design_events.tef

Cell Size == 5
Read GIS == gis\\2d_code_M01.shp
Read GRID == grids\\dem_5m.asc
BC Database == bc_dbase\\bc_dbase.csv
Read Materials File == materials\\materials.tmf
Output Folder == results\\<<~s1~>>\\
`;

const starterInputs: ProjectInput[] = [
  classifyInput('M01_001.tgc', 'model\\M01_001.tgc'),
  classifyInput('M01_001.tbc', 'bc\\M01_001.tbc'),
  classifyInput('design_events.tef', 'events\\design_events.tef'),
  classifyInput('2d_code_M01.shp', 'gis\\2d_code_M01.shp'),
  classifyInput('dem_5m.asc', 'grids\\dem_5m.asc'),
  classifyInput('bc_dbase.csv', 'bc_dbase\\bc_dbase.csv'),
  classifyInput('materials.tmf', 'materials\\materials.tmf')
];

interface OpenFileTab {
  id: string;
  name: string;
  text: string;
  savedText: string;
  undoStack: string[];
  redoStack: string[];
}

const starterFile: OpenFileTab = {
  id: 'starter-model',
  name: 'model.tcf',
  text: starterText,
  savedText: starterText,
  undoStack: [],
  redoStack: []
};

const historyLimit = 100;

function App() {
  const [files, setFiles] = useState<OpenFileTab[]>([starterFile]);
  const [activeFileId, setActiveFileId] = useState(starterFile.id);
  const [inputs, setInputs] = useState<ProjectInput[]>(starterInputs);
  const [activeLine, setActiveLine] = useState(1);
  const [requestedLine, setRequestedLine] = useState<{ lineNumber: number; nonce: number } | null>(null);
  const [search, setSearch] = useState('');

  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const text = activeFile?.text ?? '';
  const hasUnsavedFiles = files.some((file) => file.text !== file.savedText);
  const problems = useMemo(() => validateTuflowText(text, inputs), [text, inputs]);

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
    setActiveLine(1);
    setRequestedLine(null);
  };

  const closeFile = (id: string) => {
    const fileToClose = files.find((file) => file.id === id);
    if (fileToClose && fileToClose.text !== fileToClose.savedText && !window.confirm(`Discard unsaved changes to "${fileToClose.name}"?`)) {
      return;
    }

    setFiles((current) => {
      if (current.length === 1) return current;
      const nextFiles = current.filter((file) => file.id !== id);
      if (id === activeFileId) {
        setActiveFileId(nextFiles.at(-1)?.id ?? nextFiles[0].id);
        setActiveLine(1);
        setRequestedLine(null);
      }
      return nextFiles;
    });
  };

  const newFile = () => {
    const nextFile: OpenFileTab = {
      id: `new-${crypto.randomUUID()}`,
      name: `untitled-${files.length + 1}.tcf`,
      text: '! New TUFLOW control file\n',
      savedText: '',
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
  const exportProblems = () => downloadText(`${stripExtension(activeFile.name)}-problems.json`, JSON.stringify(problems, null, 2));
  const goToLine = (line: number) => {
    setActiveLine(line);
    setRequestedLine({ lineNumber: line, nonce: Date.now() });
  };

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark">TN</span>
          <div>
            <h1>TUFLOW NPad</h1>
            <p>Control file editor</p>
          </div>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={newFile} title="New file">
            <FilePlus2 size={17} />
            New
          </button>
          <label className="button-like" title="Open files">
            <FolderOpen size={17} />
            Open
            <input type="file" multiple accept=".tcf,.tgc,.tbc,.ecf,.tef,.trd,.tsoilf,.tmf,.txt,.csv,.dat,.ini,.cfg" onChange={(event) => openFiles(event, setFiles, selectFile)} />
          </label>
          <button type="button" onClick={saveFile} title="Save active file">
            <Save size={17} />
            Save
          </button>
          <button type="button" onClick={undo} title="Undo" disabled={activeFile.undoStack.length === 0}>
            <Undo2 size={17} />
            Undo
          </button>
          <button type="button" onClick={redo} title="Redo" disabled={activeFile.redoStack.length === 0}>
            <Redo2 size={17} />
            Redo
          </button>
          <button type="button" onClick={() => goToLine(problems[0]?.lineNumber ?? activeLine)} title="Validate">
            <PlayCircle size={17} />
            Validate
          </button>
          <button type="button" onClick={() => updateActiveText(formatTuflowText(text), true)} title="Format assignments">
            <AlignLeft size={17} />
            Format
          </button>
          <button type="button" onClick={exportProblems} title="Export problems">
            <Download size={17} />
            Export
          </button>
        </div>
      </header>

      <main className="workspace">
        <FilePanel inputs={inputs} onAddInput={(input) => setInputs((current) => [...current, input])} onRemoveInput={(id) => setInputs((current) => current.filter((input) => input.id !== id))} />
        <section className="editor-column">
          <Editor
            value={text}
            onChange={setActiveText}
            fileTabs={files.map(({ id, name, savedText, text }) => ({ id, name, isDirty: text !== savedText }))}
            activeFileId={activeFile.id}
            onSelectFile={selectFile}
            onCloseFile={closeFile}
            onUndo={undo}
            onRedo={redo}
            inputs={inputs}
            problems={problems}
            activeLine={activeLine}
            onActiveLineChange={setActiveLine}
            requestedLine={requestedLine}
            search={search}
            onSearchChange={setSearch}
          />
          <ProblemsPanel problems={problems} activeLine={activeLine} onSelectLine={goToLine} />
        </section>
        <CommandHelp activeLine={activeLine} text={text} />
      </main>
    </div>
  );
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
  const text = await file.text();
  return {
    id: `${file.name}-${file.lastModified}-${file.size}-${crypto.randomUUID()}`,
    name: file.name,
    text,
    savedText: text,
    undoStack: [],
    redoStack: []
  };
}

function stripExtension(filename: string) {
  const index = filename.lastIndexOf('.');
  return index > 0 ? filename.slice(0, index) : filename;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
