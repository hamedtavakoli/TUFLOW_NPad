import { ExternalLink } from 'lucide-react';
import { findCommand } from '../lib/commands';
import type { CommandValueSpec, ValueKind } from '../lib/valuePattern';
import { highlightTuflowLine } from '../tuflow/editor/tuflowHighlighter';

interface CommandHelpProps {
  activeLine: number;
  text: string;
}

export function CommandHelp({ activeLine, text }: CommandHelpProps) {
  const line = text.split('\n')[activeLine - 1] ?? '';
  const commandText = line.includes('==') ? line.slice(0, line.indexOf('==')).trim() : line.trim();
  const command = findCommand(commandText);

  return (
    <aside className="help-panel">
      <div className="panel-header">
        <div>
          <h2>Command Help</h2>
          <p>Line {activeLine}</p>
        </div>
      </div>
      {command ? (
        <div className="help-card">
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
      ) : (
        <div className="empty-state">Select a known command to see syntax, documentation, and expected values.</div>
      )}
    </aside>
  );
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
