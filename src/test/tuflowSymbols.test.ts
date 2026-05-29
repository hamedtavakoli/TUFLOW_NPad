import { describe, expect, it } from 'vitest';
import { activeFileVariableNames, buildTuflowSymbolIndex } from '../lib/tuflowSymbols';

describe('buildTuflowSymbolIndex', () => {
  it('collects active-file variable definitions and references', () => {
    const symbols = buildTuflowSymbolIndex([
      'Set Variable START_TIME == 1',
      'Start Time == <<START_TIME>>'
    ].join('\n'));

    expect(symbols.variables).toContainEqual(expect.objectContaining({
      name: 'START_TIME',
      value: '1',
      hasDelimitedName: false
    }));
    expect(symbols.variableReferences).toContainEqual(expect.objectContaining({
      name: 'START_TIME',
      raw: '<<START_TIME>>'
    }));
  });

  it('flags variable definitions that use reference delimiters', () => {
    const symbols = buildTuflowSymbolIndex('Set Variable <<START_TIME>> == 1');

    expect(symbols.variables[0]).toMatchObject({
      name: 'START_TIME',
      hasDelimitedName: true
    });
  });

  it('collects events and scenarios from model and logic commands', () => {
    const symbols = buildTuflowSymbolIndex([
      'Model Scenarios == 5m | 10m',
      'Model Events == 01AEP | 02AEP',
      'Define Event == PMF',
      'If Scenario == GPU',
      'If Event == 20p'
    ].join('\n'));

    expect(symbols.scenarios.map((symbol) => symbol.name)).toEqual(['5m', '10m', 'GPU']);
    expect(symbols.events.map((symbol) => symbol.name)).toEqual(['01AEP', '02AEP', 'PMF', '20p']);
    expect(activeFileVariableNames(symbols)).toEqual(['01AEP', '02AEP', 'PMF', '20p', '5m', '10m', 'GPU']);
  });

  it('classifies valid and invalid filename placeholders', () => {
    const symbols = buildTuflowSymbolIndex('Output Folder == results\\~s1~\\~e10~\\~scenario1~\\');

    expect(symbols.placeholders).toEqual([
      expect.objectContaining({ raw: '~s1~', group: 'scenario', index: 1, isValid: true }),
      expect.objectContaining({ raw: '~e10~', group: 'event', index: 10, isValid: false }),
      expect.objectContaining({ raw: '~scenario1~', group: 'unknown', isValid: false })
    ]);
  });

  it('reports unbalanced event and scenario logic blocks', () => {
    const symbols = buildTuflowSymbolIndex([
      'Else If Scenario == 10m',
      'If Event == PMF',
      'End If',
      'End If'
    ].join('\n'));

    expect(symbols.logicProblems.map((problem) => problem.message)).toEqual([
      '"Else If Scenario" appears without an open "If" block.',
      '"End If" appears without an open "If Event" or "If Scenario" block.'
    ]);
  });
});
