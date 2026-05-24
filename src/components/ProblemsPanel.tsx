import type { Problem } from '../lib/types';

interface ProblemsPanelProps {
  problems: Problem[];
  activeLine: number;
  onSelectLine: (line: number) => void;
}

export function ProblemsPanel({ problems, activeLine, onSelectLine }: ProblemsPanelProps) {
  return (
    <section className="problems-panel">
      <div className="panel-header compact">
        <h2>Problems</h2>
        <p>{problems.length === 0 ? 'No warnings' : `${problems.length} issue${problems.length === 1 ? '' : 's'}`}</p>
      </div>
      <div className="problem-list">
        {problems.length === 0 ? (
          <div className="empty-state">Validation is clean.</div>
        ) : (
          problems.map((problem) => (
            <button className={`problem-row ${problem.severity} ${activeLine === problem.lineNumber ? 'active' : ''}`} key={problem.id} type="button" onClick={() => onSelectLine(problem.lineNumber)}>
              <span>Line {problem.lineNumber}</span>
              <strong>{problem.message}</strong>
              {problem.suggestion ? <small>{problem.suggestion}</small> : null}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
