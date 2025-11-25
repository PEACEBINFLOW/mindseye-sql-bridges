import {
  BackendTarget,
  LegacyScript,
  LegacyTranslationResult,
  TimeBlockHint,
  RouteHint
} from './types';

/**
 * Very small, line-based legacy script adapter.
 * This is intentionally simple and opinionated.
 */
export class LegacyScriptAdapter {
  translate(script: string): LegacyTranslationResult {
    const lines = script
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const state: LegacyScript = {
      filters: [],
      selectColumns: []
    };

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('OPEN ')) {
        state.table = line.slice(5).trim();
      } else if (upper.startsWith('FILTER ')) {
        const expr = line.slice(7).trim();
        state.filters.push(expr);
      } else if (upper.startsWith('SELECT ')) {
        const cols = line.slice(7).split(',').map(c => c.trim());
        state.selectColumns.push(...cols);
      } else if (upper.startsWith('TIME WINDOW ')) {
        state.timeWindow = line.slice('TIME WINDOW '.length).trim();
      } else if (upper.startsWith('ROUTE ')) {
        const rest = line.slice(6).trim(); // e.g. "BIGQUERY lane=events"
        const [targetRaw, ...restParts] = rest.split(/\s+/);
        state.routeTarget = this.normalizeTarget(
          targetRaw.toLowerCase()
        ) as BackendTarget;
        const lanePart = restParts.find(p => p.startsWith('lane='));
        if (lanePart) {
          state.routeLane = lanePart.split('=')[1];
        }
      }
    }

    const sql = this.buildSQL(state);
    const timeBlock: TimeBlockHint | undefined = state.timeWindow
      ? { kind: 'time_block', value: state.timeWindow }
      : undefined;

    const route: RouteHint | undefined = state.routeTarget
      ? {
          kind: 'route',
          target: state.routeTarget,
          lane: state.routeLane
        }
      : undefined;

    return {
      sql,
      metadata: {
        timeBlock,
        route,
        originalScript: script
      }
    };
  }

  private buildSQL(state: LegacyScript): string {
    if (!state.table) {
      throw new Error('Legacy script missing OPEN statement');
    }

    const columns =
      state.selectColumns.length > 0
        ? state.selectColumns.join(', ')
        : '*';

    const parts: string[] = [];
    parts.push(`SELECT ${columns}`);
    parts.push(`FROM ${state.table}`);

    if (state.filters.length > 0) {
      parts.push('WHERE ' + state.filters.join(' AND '));
    }

    if (state.timeWindow) {
      parts.push(`@time(block => ${state.timeWindow})`);
    }

    if (state.routeTarget) {
      const lanePart = state.routeLane
        ? `, lane => '${state.routeLane}'`
        : '';
      parts.push(
        `@route(target => '${state.routeTarget}'${lanePart})`
      );
    }

    return parts.join('\n');
  }

  private normalizeTarget(raw: string): BackendTarget {
    switch (raw) {
      case 'bigquery':
        return 'bigquery';
      case 'cloudsql':
      case 'cloud_sql':
      case 'sql':
        return 'cloudsql';
      case 'firestore':
        return 'firestore';
      case 'gcs':
      case 'storage':
        return 'gcs';
      default:
        // default to bigquery for now
        return 'bigquery';
    }
  }
}
