import { LegacyScriptAdapter } from '../src/legacy_script_adapter';

describe('LegacyScriptAdapter', () => {
  const adapter = new LegacyScriptAdapter();

  const script = `
OPEN customers
FILTER country = "BW"
FILTER balance > 0
SELECT id, name, balance
TIME WINDOW LAST_30_DAYS
ROUTE CLOUD_SQL lane=billing
`;

  test('translates legacy script to MindsEye SQL + metadata', () => {
    const result = adapter.translate(script);

    expect(result.sql).toContain('SELECT id, name, balance');
    expect(result.sql).toContain('FROM customers');
    expect(result.sql).toContain(
      'WHERE country = "BW" AND balance > 0'
    );
    expect(result.sql).toContain(
      '@time(block => LAST_30_DAYS)'
    );
    expect(result.sql).toContain(
      "@route(target => 'cloudsql', lane => 'billing')"
    );

    expect(result.metadata.originalScript).toContain('OPEN customers');
    expect(result.metadata.timeBlock?.value).toBe('LAST_30_DAYS');
    expect(result.metadata.route?.target).toBe('cloudsql');
    expect(result.metadata.route?.lane).toBe('billing');
  });
});
