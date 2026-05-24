import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlignLeft, Download, FilePlus2, FolderOpen, PlayCircle, Save } from 'lucide-react';
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

function App() {
  const [text, setText] = useState(starterText);
  const [inputs, setInputs] = useState<ProjectInput[]>(starterInputs);
  const [activeLine, setActiveLine] = useState(1);
  const [search, setSearch] = useState('');

  const problems = useMemo(() => validateTuflowText(text, inputs), [text, inputs]);

  const newFile = () => setText('! New TUFLOW control file\n');
  const saveFile = () => downloadText('model.tcf', text);
  const exportProblems = () => downloadText('tuflow-problems.json', JSON.stringify(problems, null, 2));

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
          <label className="button-like" title="Open file">
            <FolderOpen size={17} />
            Open
            <input type="file" accept=".tcf,.tgc,.tbc,.ecf,.tef,.trd,.tsoilf,.txt" onChange={(event) => openFile(event, setText)} />
          </label>
          <button type="button" onClick={saveFile} title="Save file">
            <Save size={17} />
            Save
          </button>
          <button type="button" onClick={() => setActiveLine(problems[0]?.lineNumber ?? activeLine)} title="Validate">
            <PlayCircle size={17} />
            Validate
          </button>
          <button type="button" onClick={() => setText(formatTuflowText(text))} title="Format assignments">
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
            onChange={setText}
            inputs={inputs}
            problems={problems}
            activeLine={activeLine}
            onActiveLineChange={setActiveLine}
            search={search}
            onSearchChange={setSearch}
          />
          <ProblemsPanel problems={problems} activeLine={activeLine} onSelectLine={setActiveLine} />
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

async function openFile(event: React.ChangeEvent<HTMLInputElement>, setText: (text: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  setText(await file.text());
  event.target.value = '';
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
