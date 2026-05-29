import { describe, expect, it } from 'vitest';
import { findCommand, tuflowCommandCatalog, tuflowCommands } from '../lib/commands';

describe('runtime TUFLOW command source', () => {
  it('loads the 2026 command catalog', () => {
    expect(tuflowCommandCatalog.commands.length).toBeGreaterThan(650);
    expect(tuflowCommands.length).toBeGreaterThan(800);

    const command = findCommand('AD Control File');
    expect(command).toMatchObject({
      category: 'TCF',
      sourceUrl: expect.stringContaining('/2026.0/'),
      summary: expect.stringContaining('TUFLOW AD control file')
    });
  });
});
