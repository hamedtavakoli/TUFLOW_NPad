import type { Problem } from '../lib/types';

interface ProblemsPanelProps {
  problems: Problem[];
  activeLine: number;
  showMissingInputProblems: boolean;
  onShowMissingInputProblemsChange: (show: boolean) => void;
  onSelectLine: (line: number) => void;
}

export function ProblemsPanel({
  problems,
  activeLine,
  showMissingInputProblems,
  onShowMissingInputProblemsChange,
  onSelectLine
}: ProblemsPanelProps) {
  return (
    <section className="problems-panel">
      <div className="panel-header compact">
        <h2>Diagnostics</h2>
        <div className="problem-header-actions">
          <p>{problems.length === 0 ? 'No issues' : `${problems.length} issue${problems.length === 1 ? '' : 's'}`}</p>
          <label className="switch-control" title="Show reference availability checks">
            <input
              type="checkbox"
              checked={showMissingInputProblems}
              onChange={(event) => onShowMissingInputProblemsChange(event.target.checked)}
            />
            <span />
            Reference Checks
          </label>
        </div>
      </div>
      <div className="problem-list">
        {problems.length === 0 ? (
          <div className="empty-state">All checks clear.</div>
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
