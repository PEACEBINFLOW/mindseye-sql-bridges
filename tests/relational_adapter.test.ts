import { RelationalAlgebraAdapter } from '../src/relational_adapter';
import {
  RATable,
  RASelection,
  RAProjection,
  BridgeOptions
} from '../src/types';

describe('RelationalAlgebraAdapter', () => {
  const adapter = new RelationalAlgebraAdapter();

  const users: RATable = {
    kind: 'table',
    name: 'users',
    alias: 'u'
  };

  test('simple projection + selection → SQL with hints', () => {
    const selection: RASelection = {
      kind: 'selection',
      from: users,
      predicate: { kind: 'gt', column: 'u.age', value: 18 }
    };

    const projection: RAProjection = {
      kind: 'projection',
      from: selection,
      columns: ['u.id', 'u.name', 'u.age']
    };

    const options: BridgeOptions = {
      timeBlock: { kind: 'time_block', value: 'LAST_7_DAYS' },
      route: { kind: 'route', target: 'bigquery', lane: 'timeline' }
    };

    const sql = adapter.toMindsEyeSQL(projection, options);

    expect(sql).toContain('SELECT u.id, u.name, u.age');
    expect(sql).toContain('FROM users AS u');
    expect(sql).toContain('WHERE u.age > 18');
    expect(sql).toContain('@time(block => LAST_7_DAYS)');
    expect(sql).toContain(
      "@route(target => 'bigquery', lane => 'timeline')"
    );
  });
});
