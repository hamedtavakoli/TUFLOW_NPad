import { describe, expect, it } from 'vitest';
import sampleTcf from '../../assets/WTP_~s1~_~s2~_~s3~_~e1~~e2~~e3~_006.tcf?raw';
import { validateTuflowText } from '../lib/validator';

describe('sample TCF validation', () => {
  it('does not report false value-shape warnings for the WTP sample control file', () => {
    const problems = validateTuflowText(sampleTcf, []);

    expect(problems).not.toContainEqual(expect.objectContaining({
      lineNumber: 11,
      id: expect.stringMatching(/^empty-ref/)
    }));
    expect(problems).not.toContainEqual(expect.objectContaining({
      lineNumber: 27,
      id: expect.stringMatching(/^option/)
    }));
    expect(problems).not.toContainEqual(expect.objectContaining({
      lineNumber: 31,
      id: expect.stringMatching(/^option/)
    }));
  });
});
