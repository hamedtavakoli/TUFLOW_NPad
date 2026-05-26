import { ExternalLink } from 'lucide-react';
import { findCommand } from '../lib/commands';
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
          {command.allowedFileTypes.length > 0 ? (
            <>
              <h4>Expected value</h4>
              <div className="extension-list">
                {command.allowedFileTypes.map((extension) => (
                  <span key={extension}>{extension}</span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">Select a known command to see syntax, documentation, and expected values.</div>
      )}
    </aside>
  );
}
