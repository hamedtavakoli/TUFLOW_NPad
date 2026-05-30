import { useEffect, useRef, useState } from 'react';
import type { Problem } from '../lib/types';

interface ProblemsPanelProps {
  problems: Problem[];
  activeLine: number;
  selectedLineRequest: { lineNumber: number; nonce: number } | null;
  showMissingInputProblems: boolean;
  onShowMissingInputProblemsChange: (show: boolean) => void;
  onSelectLine: (line: number) => void;
}

export function ProblemsPanel({
  problems,
  activeLine,
  selectedLineRequest,
  showMissingInputProblems,
  onShowMissingInputProblemsChange,
  onSelectLine
}: ProblemsPanelProps) {
  const [selectedProblemId, setSelectedProblemId] = useState<string | undefined>();
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!selectedLineRequest) return;
    const problem = problems.find((candidate) => candidate.lineNumber === selectedLineRequest.lineNumber);
    if (problem) {
      selectProblem(problem, { focusRow: false, jumpToLine: false });
    }
  }, [selectedLineRequest?.nonce, problems]);

  const selectProblem = (problem: Problem, options: { focusRow: boolean; jumpToLine: boolean }) => {
    setSelectedProblemId(problem.id);
    if (options.jumpToLine) {
      onSelectLine(problem.lineNumber);
    }
    requestAnimationFrame(() => {
      const row = rowRefs.current.get(problem.id);
      row?.scrollIntoView({ block: 'start' });
      if (options.focusRow) {
        row?.focus({ preventScroll: true });
      }
    });
  };

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
            <button
              className={`problem-row ${problem.severity} ${activeLine === problem.lineNumber ? 'active' : ''} ${selectedProblemId === problem.id ? 'selected' : ''}`}
              key={problem.id}
              ref={(node) => {
                if (node) {
                  rowRefs.current.set(problem.id, node);
                } else {
                  rowRefs.current.delete(problem.id);
                }
              }}
              type="button"
              title={problem.suggestion ? `${problem.message}\n${problem.suggestion}` : problem.message}
              onClick={() => selectProblem(problem, { focusRow: true, jumpToLine: true })}
            >
              <span>Line {problem.lineNumber}</span>
              <strong>{problem.message}</strong>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
