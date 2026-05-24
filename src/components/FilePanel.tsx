import type { DragEvent, FormEvent } from 'react';
import { Plus, Trash2, UploadCloud } from 'lucide-react';
import { classifyInput } from '../lib/autocomplete';
import type { ProjectInput } from '../lib/types';

interface FilePanelProps {
  inputs: ProjectInput[];
  onAddInput: (input: ProjectInput) => void;
  onRemoveInput: (id: string) => void;
}

export function FilePanel({ inputs, onAddInput, onRemoveInput }: FilePanelProps) {
  const grouped = inputs.reduce<Record<string, ProjectInput[]>>((acc, input) => {
    acc[input.type] = [...(acc[input.type] ?? []), input];
    return acc;
  }, {});

  return (
    <aside className="file-panel" onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, onAddInput)}>
      <div className="panel-header">
        <div>
          <h2>Project Inputs</h2>
          <p>{inputs.length} registered</p>
        </div>
        <label className="icon-button" title="Upload inputs">
          <UploadCloud size={18} />
          <input multiple type="file" onChange={(event) => handleFiles(event.target.files, onAddInput)} />
        </label>
      </div>
      <form className="manual-add" onSubmit={(event) => handleManualAdd(event, onAddInput)}>
        <input name="path" placeholder="gis\\2d_bc_M01.shp" />
        <button type="submit" title="Register input">
          <Plus size={16} />
        </button>
      </form>
      <div className="drop-zone">Drop model inputs here</div>
      <div className="input-groups">
        {Object.entries(grouped).map(([type, items]) => (
          <section key={type}>
            <h3>{type}</h3>
            {items.map((input) => (
              <div className="input-row" key={input.id}>
                <span className="file-dot" />
                <div>
                  <strong>{input.name}</strong>
                  <small>{input.path}</small>
                </div>
                <button type="button" onClick={() => onRemoveInput(input.id)} title="Remove input">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

function handleDrop(event: DragEvent, onAddInput: (input: ProjectInput) => void) {
  event.preventDefault();
  handleFiles(event.dataTransfer.files, onAddInput);
}

function handleFiles(files: FileList | null, onAddInput: (input: ProjectInput) => void) {
  Array.from(files ?? []).forEach((file) => onAddInput(classifyInput(file.name, file.webkitRelativePath || file.name)));
}

function handleManualAdd(event: FormEvent<HTMLFormElement>, onAddInput: (input: ProjectInput) => void) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const path = String(form.get('path') ?? '').trim();
  if (!path) return;
  onAddInput(classifyInput(path.split(/[\\/]/).at(-1) ?? path, path));
  event.currentTarget.reset();
}
