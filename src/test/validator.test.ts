import { describe, expect, it } from 'vitest';
import { classifyInput } from '../lib/autocomplete';
import { createProjectFileIndex } from '../lib/projectFiles';
import { validateTuflowText } from '../lib/validator';

describe('validateTuflowText', () => {
  it('warns when a referenced file is not found in project files', () => {
    const problems = validateTuflowText('BC Control File == model\\missing.tbc', []);

    expect(problems.some((problem) => problem.id.startsWith('missing-input'))).toBe(true);
  });

  it('reports missing assignment for a known command', () => {
    const problems = validateTuflowText('BC Control File model\\model.tbc', [classifyInput('model.tbc', 'model\\model.tbc')]);

    expect(problems[0]).toMatchObject({
      severity: 'error',
      message: '"BC Control File" is missing the == assignment operator.'
    });
  });

  it('warns when a file extension is inconsistent with the command', () => {
    const problems = validateTuflowText('BC Control File == gis\\roughness.shp', [classifyInput('roughness.shp', 'gis\\roughness.shp')]);

    expect(problems.some((problem) => problem.id.startsWith('extension'))).toBe(true);
  });

  it('does not warn for repeated commands while block-aware duplicate checks are disabled', () => {
    const problems = validateTuflowText('Cell Size == 5\nCell Size == 10', []);

    expect(problems.some((problem) => problem.id.startsWith('duplicate-Cell Size'))).toBe(false);
  });

  it('normalises command spacing and case before configured command matching', () => {
    const problems = validateTuflowText('bc    control    file == model\\model.tbc', [classifyInput('model.tbc', 'model\\model.tbc')]);

    expect(problems.some((problem) => problem.id.startsWith('unknown'))).toBe(false);
    expect(problems.some((problem) => problem.id.startsWith('command-token'))).toBe(false);
  });

  it('does not warn for known keyword phrases that are not configured yet', () => {
    const problems = validateTuflowText('Read GIS Z Shape == gis\\zshape.shp', [classifyInput('zshape.shp', 'gis\\zshape.shp')]);

    expect(problems.some((problem) => problem.id.startsWith('unknown'))).toBe(false);
    expect(problems.some((problem) => problem.id.startsWith('command-token'))).toBe(false);
  });

  it('soft-warns for unknown command tokens without breaking parsing', () => {
    const problems = validateTuflowText('Reed GIS == gis\\2d_code.shp', [classifyInput('2d_code.shp', 'gis\\2d_code.shp')]);

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'command-token-1',
      severity: 'warning',
      message: 'Possible typo in command word(s): Reed.'
    }));
  });

  it('sorts problems by line number, severity, and message', () => {
    const problems = validateTuflowText(
      [
        'BC Control File == gis\\missing.txt',
        'Cell Size 5',
        'Geometry Control File == gis\\missing.shp'
      ].join('\n'),
      []
    );

    expect(problems.map((problem) => [problem.lineNumber, problem.severity, problem.message])).toEqual([
      [1, 'warning', '"gis\\missing.txt" does not match expected type for "BC Control File".'],
      [1, 'warning', 'Referenced input "gis\\missing.txt" was not found in the active project.'],
      [2, 'error', '"Cell Size" is missing the == assignment operator.'],
      [3, 'warning', '"gis\\missing.shp" does not match expected type for "Geometry Control File".'],
      [3, 'warning', 'Referenced input "gis\\missing.shp" was not found in the active project.']
    ]);
  });

  it('warns when an option-only command uses an unsupported value', () => {
    const problems = validateTuflowText('MI Projection Check Ignore Bounds == MAYBE', []);

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'option-1',
      severity: 'warning',
      message: '"MI Projection Check Ignore Bounds" expects one of: OFF, ON.'
    }));
  });

  it('accepts configured option values without warnings', () => {
    const problems = validateTuflowText('MI Projection Check Ignore Bounds == ON', []);

    expect(problems.some((problem) => problem.id.startsWith('option'))).toBe(false);
  });

  it('warns when a numeric command receives text', () => {
    const problems = validateTuflowText('Timestep == abc', []);

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'number-1',
      severity: 'warning',
      message: '"Timestep" expects a numeric value.'
    }));
  });

  it('accepts numeric values for numeric commands', () => {
    const problems = validateTuflowText('Timestep == 1.0', []);

    expect(problems.some((problem) => problem.id.startsWith('number'))).toBe(false);
  });

  it('accepts inline MI projection text without requiring a .mif file reference', () => {
    const problems = validateTuflowText(
      'MI Projection == CoordSys Earth Projection 8, 116, "m", 147, 0, 0.9996, 500000, 10000000 Bounds (0, 1000000) (5500000, 6500000)',
      []
    );

    expect(problems.some((problem) => problem.id.startsWith('empty-ref'))).toBe(false);
  });

  it('accepts free event and scenario condition names', () => {
    const problems = validateTuflowText('IF Event == PMF\nIF Scenario == GPU', []);

    expect(problems.some((problem) => problem.id.startsWith('option'))).toBe(false);
  });

  it('accepts placeholder values beyond the documented default option', () => {
    const problems = validateTuflowText('Map Output Format == XMDF ASC', []);

    expect(problems.some((problem) => problem.id.startsWith('option'))).toBe(false);
  });

  it('accepts mixed option/file commands when the option is used', () => {
    const problems = validateTuflowText('Quadtree Control File == Single Level', []);

    expect(problems.some((problem) => problem.id.startsWith('empty-ref'))).toBe(false);
    expect(problems.some((problem) => problem.id.startsWith('missing-input'))).toBe(false);
  });

  it('does not apply optional numeric checks to file references in compound patterns', () => {
    const problems = validateTuflowText('Read Materials File == materials\\materials.tmf', [
      classifyInput('materials.tmf', 'materials\\materials.tmf')
    ]);

    expect(problems.some((problem) => problem.id.startsWith('number'))).toBe(false);
  });

  it('reports assignment on commands that do not take values', () => {
    const problems = validateTuflowText('End Define == extra', []);

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'unexpected-assignment-1',
      severity: 'error',
      message: '"End Define" does not use the == assignment operator.'
    }));
  });

  it('checks referenced files against a project root index when requested', () => {
    const projectFileIndex = createProjectFileIndex('Model Root', ['model\\model.tbc']);
    const problems = validateTuflowText('BC Control File == model\\missing.tbc', [], {
      checkProjectFiles: true,
      projectFileIndex
    });

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'missing-input-1',
      message: 'Referenced input "model\\missing.tbc" was not found in Model Root.'
    }));
  });

  it('does not treat output folders as missing project files', () => {
    const projectFileIndex = createProjectFileIndex('Model Root', []);
    const problems = validateTuflowText('Output Folder == results\\<<~s1~>>\\', [], {
      checkProjectFiles: true,
      projectFileIndex
    });

    expect(problems.some((problem) => problem.id.startsWith('missing-input'))).toBe(false);
    expect(problems.some((problem) => problem.id.startsWith('uncheckable-input'))).toBe(false);
  });

  it('marks variable file references as uncheckable rather than missing', () => {
    const projectFileIndex = createProjectFileIndex('Model Root', []);
    const problems = validateTuflowText('BC Control File == bc\\<<~s1~>>.tbc', [], {
      checkProjectFiles: true,
      projectFileIndex
    });

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'uncheckable-input-1',
      severity: 'info'
    }));
    expect(problems.some((problem) => problem.id.startsWith('missing-input'))).toBe(false);
  });

  it('reports references inside excluded folders as informational', () => {
    const projectFileIndex = createProjectFileIndex('Model Root', [], {
      excludedFolderNames: ['results']
    });
    const problems = validateTuflowText('Read GIS == results\\check.shp', [], {
      checkProjectFiles: true,
      projectFileIndex
    });

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'excluded-input-1',
      severity: 'info',
      message: 'Referenced input "results\\check.shp" is inside an excluded folder.'
    }));
  });

  it('warns when Set Variable uses reference delimiters in the definition name', () => {
    const problems = validateTuflowText('Set Variable <<START_TIME>> == 1', []);

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'variable-definition-1',
      severity: 'warning',
      message: '"Set Variable" defines "START_TIME" with <<...>> delimiters.'
    }));
  });

  it('does not warn for active-file variable references that are defined in the active file', () => {
    const problems = validateTuflowText('Set Variable START_TIME == 1\nStart Time == <<START_TIME>>', []);

    expect(problems.some((problem) => problem.id.startsWith('unknown-variable'))).toBe(false);
    expect(problems.some((problem) => problem.id.startsWith('command-token'))).toBe(false);
  });

  it('accepts active-file variables in numeric value slots', () => {
    const problems = validateTuflowText('Set Variable sos == 2\nTimestep == <<sos>>', []);

    expect(problems.some((problem) => problem.id.startsWith('number'))).toBe(false);
    expect(problems.some((problem) => problem.id.startsWith('unknown-variable'))).toBe(false);
  });

  it('accepts variables in option-only value slots', () => {
    const problems = validateTuflowText('Set Variable CHECK_BOUNDS == ON\nMI Projection Check Ignore Bounds == <<CHECK_BOUNDS>>', []);

    expect(problems.some((problem) => problem.id.startsWith('option'))).toBe(false);
  });

  it('accepts variables in file reference value slots', () => {
    const problems = validateTuflowText('Set Variable BC_FILE == bc\\model.tbc\nBC Control File == <<BC_FILE>>', []);

    expect(problems.some((problem) => problem.id.startsWith('empty-ref'))).toBe(false);
  });

  it('reports variable references that are not defined in the active file', () => {
    const problems = validateTuflowText('Start Time == <<START_TIME>>', []);

    expect(problems).toContainEqual(expect.objectContaining({
      id: 'unknown-variable-1-START_TIME',
      severity: 'info',
      message: 'Variable "START_TIME" is not defined in the active file.'
    }));
  });

  it('accepts scenario and event names as active-file variables', () => {
    const problems = validateTuflowText('Model Scenarios == 5m\nModel Events == 01AEP\nStart Time == <<5m>>\nEnd Time == <<01AEP>>', []);

    expect(problems.some((problem) => problem.id.startsWith('unknown-variable'))).toBe(false);
  });

  it('warns for invalid event and scenario filename placeholders', () => {
    const problems = validateTuflowText('Output Folder == results\\~s10~\\~e0~\\', []);

    expect(problems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'placeholder-1-0',
        severity: 'warning',
        message: 'Invalid event/scenario filename placeholder "~s10~".'
      }),
      expect.objectContaining({
        id: 'placeholder-1-1',
        severity: 'warning',
        message: 'Invalid event/scenario filename placeholder "~e0~".'
      })
    ]));
  });
});
