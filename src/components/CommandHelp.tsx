import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { findCommand, tuflowCommands } from '../lib/commands';
import { allCommandCategories, filterCommandLibrary, type CommandLegacyFilter } from '../lib/commandLibrary';
import type { TuflowCommand } from '../lib/types';
import type { CommandValueSpec, ValueKind } from '../lib/valuePattern';
import { highlightTuflowLine } from '../tuflow/editor/tuflowHighlighter';

interface CommandHelpProps {
  activeLine: number;
  text: string;
  isEnabled: boolean;
}

type CommandHelpTab = 'line' | 'library';

export function CommandHelp({ activeLine, text, isEnabled }: CommandHelpProps) {
  const [activeTab, setActiveTab] = useState<CommandHelpTab>('line');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('all');
  const [libraryLegacy, setLibraryLegacy] = useState<CommandLegacyFilter>('all');
  const [selectedCommandName, setSelectedCommandName] = useState<string | undefined>();
  const lineCommand = isEnabled ? commandFromActiveLine(text, activeLine) : undefined;
  const libraryCommands = useMemo(
    () =>
      filterCommandLibrary(tuflowCommands, {
        search: librarySearch,
        category: libraryCategory,
        legacy: libraryLegacy
      }),
    [libraryCategory, libraryLegacy, librarySearch]
  );
  const selectedCommand =
    libraryCommands.find((command) => command.name === selectedCommandName) ?? libraryCommands[0];

  return (
    <aside className="help-panel">
      <div className="panel-header command-help-header">
        <div>
          <h2>Command Help</h2>
          <p>{activeTab === 'line' ? `Line ${activeLine}` : `${libraryCommands.length} command${libraryCommands.length === 1 ? '' : 's'}`}</p>
        </div>
        <div className="command-help-tabs" role="tablist" aria-label="Command help views">
          <button type="button" className={activeTab === 'line' ? 'active' : ''} onClick={() => setActiveTab('line')}>
            Line
          </button>
          <button type="button" className={activeTab === 'library' ? 'active' : ''} onClick={() => setActiveTab('library')}>
            Library
          </button>
        </div>
      </div>
      {activeTab === 'line' ? (
        <LineHelp isEnabled={isEnabled} command={lineCommand} />
      ) : (
        <CommandLibrary
          commands={libraryCommands}
          selectedCommand={selectedCommand}
          search={librarySearch}
          category={libraryCategory}
          legacy={libraryLegacy}
          onSearchChange={setLibrarySearch}
          onCategoryChange={setLibraryCategory}
          onLegacyChange={setLibraryLegacy}
          onSelectCommand={(command) => setSelectedCommandName(command.name)}
        />
      )}
    </aside>
  );
}

function LineHelp({ isEnabled, command }: { isEnabled: boolean; command: TuflowCommand | undefined }) {
  if (!isEnabled) {
    return <div className="empty-state">Line help is available for TUFLOW control files.</div>;
  }

  return command ? (
    <CommandDetailCard command={command} />
  ) : (
    <div className="empty-state">Select a known command to see syntax, documentation, and expected values.</div>
  );
}

function CommandLibrary({
  commands,
  selectedCommand,
  search,
  category,
  legacy,
  onSearchChange,
  onCategoryChange,
  onLegacyChange,
  onSelectCommand
}: {
  commands: TuflowCommand[];
  selectedCommand: TuflowCommand | undefined;
  search: string;
  category: string;
  legacy: CommandLegacyFilter;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: string) => void;
  onLegacyChange: (legacy: CommandLegacyFilter) => void;
  onSelectCommand: (command: TuflowCommand) => void;
}) {
  return (
    <div className="command-library">
      <div className="command-library-controls">
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search commands" />
        <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="all">All categories</option>
          {allCommandCategories.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={legacy} onChange={(event) => onLegacyChange(event.target.value as CommandLegacyFilter)}>
          <option value="all">All commands</option>
          <option value="current">Current</option>
          <option value="legacy">Legacy</option>
        </select>
      </div>
      {commands.length === 0 ? (
        <div className="empty-state compact">No commands match the current filters.</div>
      ) : (
        <>
          <div className="command-library-list" role="listbox" aria-label="TUFLOW command library">
            {commands.slice(0, 120).map((command) => (
              <button
                type="button"
                className={`command-library-row ${selectedCommand?.name === command.name ? 'active' : ''}`}
                key={`${command.category}:${command.name}`}
                onClick={() => onSelectCommand(command)}
              >
                <span>
                  <strong>{command.name}</strong>
                  {command.isLegacy ? <em>Legacy</em> : null}
                </span>
                <code>{syntaxSuffix(command)}</code>
                <small>{command.summary ?? command.description}</small>
              </button>
            ))}
          </div>
          {commands.length > 120 ? <p className="command-library-limit">Showing 120 of {commands.length}. Refine filters to narrow results.</p> : null}
          {selectedCommand ? <CommandDetailCard command={selectedCommand} compact /> : null}
        </>
      )}
    </div>
  );
}

function CommandDetailCard({ command, compact = false }: { command: TuflowCommand; compact?: boolean }) {
  return (
    <div className={`help-card ${compact ? 'compact' : ''}`}>
      <div className="help-command-top">
        <div className="help-pills">
          <span className="category-pill">{command.category}</span>
          {command.isLegacy ? <span className="legacy-pill">Legacy</span> : null}
        </div>
        {command.sourceUrl ? (
          <a className="docs-link" href={command.sourceUrl} target="_blank" rel="noreferrer" title="Open TUFLOW documentation">
            <ExternalLink size={14} />
            Docs
          </a>
        ) : null}
      </div>
      <h3>{command.name}</h3>
      <pre className="help-syntax">{highlightTuflowLine(command.syntax, '')}</pre>
      <p>{command.description}</p>
      {command.valueSpec?.expectsValue ? (
        <>
          <h4>Expected value</h4>
          <ExpectedValue valueSpec={command.valueSpec} />
        </>
      ) : null}
    </div>
  );
}

function commandFromActiveLine(text: string, activeLine: number): TuflowCommand | undefined {
  const line = text.split('\n')[activeLine - 1] ?? '';
  const commandText = line.includes('==') ? line.slice(0, line.indexOf('==')).trim() : line.trim();
  return findCommand(commandText);
}

function syntaxSuffix(command: TuflowCommand): string {
  return command.syntax.startsWith(command.name) ? command.syntax.slice(command.name.length).trim() : command.syntax;
}

function ExpectedValue({ valueSpec }: { valueSpec: CommandValueSpec }) {
  const kinds = valueSpec.kinds.filter((kind) => kind !== 'compound' && kind !== 'unknown');

  return (
    <div className="expected-value">
      {kinds.length > 0 ? (
        <div>
          <strong>Type</strong>
          <div className="extension-list">
            {kinds.map((kind) => (
              <span key={kind}>{formatKind(kind)}</span>
            ))}
          </div>
        </div>
      ) : null}
      {valueSpec.options.length > 0 ? (
        <div>
          <strong>Options</strong>
          <div className="extension-list">
            {valueSpec.options.map((option) => (
              <span key={option}>{option}</span>
            ))}
          </div>
        </div>
      ) : null}
      {valueSpec.defaultValue ? (
        <div>
          <strong>Default</strong>
          <div className="extension-list">
            <span>{valueSpec.defaultValue}</span>
          </div>
        </div>
      ) : null}
      {valueSpec.extensions.length > 0 ? (
        <div>
          <strong>Files</strong>
          <div className="extension-list">
            {valueSpec.extensions.map((extension) => (
              <span key={extension}>{extension}</span>
            ))}
          </div>
        </div>
      ) : null}
      {valueSpec.allowsMultiple ? <small>Multiple values are allowed.</small> : null}
      {valueSpec.note ? <small>{valueSpec.note}</small> : null}
    </div>
  );
}

function formatKind(kind: ValueKind) {
  return kind === 'gis' ? 'GIS layer' : kind[0].toUpperCase() + kind.slice(1);
}
