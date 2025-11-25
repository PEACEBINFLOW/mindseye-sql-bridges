/**
 * Shared types for the SQL bridges.
 * These are intentionally minimal and focused on the adapter layer.
 */

export type BackendTarget = 'bigquery' | 'cloudsql' | 'firestore' | 'gcs';

export interface TimeBlockHint {
  kind: 'time_block';
  value: string; // e.g. "LAST_7_DAYS", "BETWEEN 2025-01-01 AND 2025-01-31"
}

export interface RouteHint {
  kind: 'route';
  target: BackendTarget;
  lane?: string; // LAW-N lane, e.g. "timeline", "billing"
}

export interface BridgeOptions {
  timeBlock?: TimeBlockHint;
  route?: RouteHint;
}

/**
 * Relational Algebra IR
 */

export interface RATable {
  kind: 'table';
  name: string;
  alias?: string;
}

export interface RASelection {
  kind: 'selection';
  from: RAExpression;
  predicate: RACondition;
}

export interface RAProjection {
  kind: 'projection';
  from: RAExpression;
  columns: string[];
}

export interface RAJoin {
  kind: 'join';
  left: RAExpression;
  right: RAExpression;
  on: RACondition;
  joinType?: 'inner' | 'left' | 'right' | 'full';
}

export type RAExpression = RATable | RASelection | RAProjection | RAJoin;

export type RACondition =
  | { kind: 'eq'; column: string; value: unknown }
  | { kind: 'gt'; column: string; value: unknown }
  | { kind: 'lt'; column: string; value: unknown }
  | { kind: 'and'; left: RACondition; right: RACondition }
  | { kind: 'or'; left: RACondition; right: RACondition };

/**
 * Legacy script IR
 */

export interface LegacyScript {
  table?: string;
  filters: string[]; // raw filter strings for now
  selectColumns: string[];
  timeWindow?: string;
  routeTarget?: BackendTarget;
  routeLane?: string;
}

export interface LegacyTranslationResult {
  sql: string;
  metadata: {
    timeBlock?: TimeBlockHint;
    route?: RouteHint;
    originalScript: string;
  };
}
