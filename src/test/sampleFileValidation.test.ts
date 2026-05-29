import { describe, expect, it } from 'vitest';
import { validateTuflowText } from '../lib/validator';

describe('sample TCF validation', () => {
  const sampleTcf = [
    'Geometry Control File == model\\M01_001.tgc',
    'BC Control File == bc\\M01_001.tbc',
    'Event File == events\\design_events.tef',
    'Output Folder == results\\<<~s1~>>\\',
    'MI Projection == CoordSys Earth Projection 8, 116, "m", 147, 0, 0.9996, 500000, 10000000 Bounds (0, 1000000) (5500000, 6500000)',
    'IF Event == PMF',
    'IF Scenario == GPU',
    'Map Output Format == XMDF ASC'
  ].join('\n');

  it('does not report false value-shape warnings for representative TCF patterns', () => {
    const problems = validateTuflowText(sampleTcf, []);

    expect(problems.some((problem) => problem.id.startsWith('empty-ref'))).toBe(false);
    expect(problems.some((problem) => problem.id.startsWith('option'))).toBe(false);
  });
});
