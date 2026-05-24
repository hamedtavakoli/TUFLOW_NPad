import { findCommand } from '../lib/commands';

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
          <span className="category-pill">{command.category}</span>
          <h3>{command.name}</h3>
          <code>{command.syntax}</code>
          <p>{command.description}</p>
          {command.allowedFileTypes.length > 0 ? (
            <>
              <h4>Expected files</h4>
              <div className="extension-list">
                {command.allowedFileTypes.map((extension) => (
                  <span key={extension}>{extension}</span>
                ))}
              </div>
            </>
          ) : null}
          <h4>Example</h4>
          <pre>{command.examples[0]}</pre>
        </div>
      ) : (
        <div className="empty-state">Select a known command to see syntax, examples, and expected input types.</div>
      )}
    </aside>
  );
}
