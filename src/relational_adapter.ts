import {
  RAExpression,
  RAProjection,
  RASelection,
  RAJoin,
  RATable,
  RACondition,
  BridgeOptions
} from './types';

/**
 * RelationalAlgebraAdapter
 *
 * Converts a small relational algebra IR into:
 * - MindsEye SQL string (with @time/@route hints)
 * - Later: logical plans via @mindseye/sql-core
 */
export class RelationalAlgebraAdapter {
  toMindsEyeSQL(expr: RAExpression, options: BridgeOptions = {}): string {
    const coreSql = this.expressionToSQL(expr);
    const hints = this.buildHints(options);
    return [coreSql, hints].filter(Boolean).join('\n');
  }

  // placeholder for future:
  // toLogicalPlan(expr: RAExpression, options: BridgeOptions = {}): LogicalPlan { ... }

  private expressionToSQL(expr: RAExpression): string {
    if (expr.kind === 'projection') {
      return this.projectionToSQL(expr);
    }
    if (expr.kind === 'selection') {
      return this.selectionToSQL(expr);
    }
    if (expr.kind === 'join') {
      return this.joinToSQL(expr);
    }
    if (expr.kind === 'table') {
      const tbl = this.tableRef(expr);
      return `SELECT *\nFROM ${tbl}`;
    }
    const _exhaustive: never = expr;
    return _exhaustive;
  }

  private projectionToSQL(expr: RAProjection): string {
    const fromSql = this.expressionFromClause(expr.from);
    const cols = expr.columns.join(', ');
    const whereSql = this.extractWhere(expr.from);
    return ['SELECT ' + cols, fromSql, whereSql].filter(Boolean).join('\n');
  }

  private selectionToSQL(expr: RASelection): string {
    const fromSql = this.expressionFromClause(expr.from);
    const whereFromInner = this.extractWhere(expr.from);
    const whereSelf = 'WHERE ' + this.conditionToSQL(expr.predicate);
    const whereCombined = this.combineWhere(whereFromInner, whereSelf);
    return ['SELECT *', fromSql, whereCombined].filter(Boolean).join('\n');
  }

  private joinToSQL(expr: RAJoin): string {
    const leftTable = this.unwrapTable(expr.left);
    const rightTable = this.unwrapTable(expr.right);

    const leftRef = this.tableRef(leftTable);
    const rightRef = this.tableRef(rightTable);

    const joinType = (expr.joinType || 'inner').toUpperCase();
    const on = this.conditionToSQL(expr.on);

    const wherePieces: string[] = [];
    const leftWhere = this.extractWhere(expr.left);
    const rightWhere = this.extractWhere(expr.right);
    if (leftWhere) wherePieces.push(leftWhere.replace(/^WHERE\s+/i, ''));
    if (rightWhere) wherePieces.push(rightWhere.replace(/^WHERE\s+/i, ''));

    const whereSql =
      wherePieces.length > 0 ? 'WHERE ' + wherePieces.join(' AND ') : '';

    return [
      'SELECT *',
      `FROM ${leftRef}`,
      `${joinType} JOIN ${rightRef} ON ${on}`,
      whereSql
    ]
      .filter(Boolean)
      .join('\n');
  }

  private tableRef(table: RATable): string {
    return table.alias ? `${table.name} AS ${table.alias}` : table.name;
  }

  private unwrapTable(expr: RAExpression): RATable {
    if (expr.kind === 'table') return expr;
    if ('from' in expr) return this.unwrapTable(expr.from as RAExpression);
    throw new Error('Cannot unwrap table from expression');
  }

  private expressionFromClause(expr: RAExpression): string {
    if (expr.kind === 'table') {
      return 'FROM ' + this.tableRef(expr);
    }
    if (expr.kind === 'selection' || expr.kind === 'projection') {
      if (expr.from.kind === 'table') {
        return 'FROM ' + this.tableRef(expr.from);
      }
    }
    if (expr.kind === 'join') {
      // For now, we rebuild from join itself
      const leftTable = this.unwrapTable(expr.left);
      const rightTable = this.unwrapTable(expr.right);
      const leftRef = this.tableRef(leftTable);
      const rightRef = this.tableRef(rightTable);
      const joinType = (expr.joinType || 'inner').toUpperCase();
      const on = this.conditionToSQL(expr.on);
      return `FROM ${leftRef}\n${joinType} JOIN ${rightRef} ON ${on}`;
    }
    throw new Error('Unsupported expression in FROM clause');
  }

  private extractWhere(expr: RAExpression): string | null {
    if (expr.kind === 'selection') {
      const pred = this.conditionToSQL(expr.predicate);
      const inner = this.extractWhere(expr.from);
      const self = 'WHERE ' + pred;
      return this.combineWhere(inner, self);
    }
    if (expr.kind === 'projection') {
      return this.extractWhere(expr.from);
    }
    if (expr.kind === 'join') {
      const left = this.extractWhere(expr.left);
      const right = this.extractWhere(expr.right);
      return this.combineWhere(left, right);
    }
    return null;
  }

  private combineWhere(a: string | null, b: string | null): string | null {
    if (!a && !b) return null;
    if (a && !b) return a;
    if (!a && b) return b;
    const aBody = a!.replace(/^WHERE\s+/i, '');
    const bBody = b!.replace(/^WHERE\s+/i, '');
    return 'WHERE ' + aBody + ' AND ' + bBody;
  }

  private conditionToSQL(cond: RACondition): string {
    switch (cond.kind) {
      case 'eq':
        return `${cond.column} = ${this.literal(cond.value)}`;
      case 'gt':
        return `${cond.column} > ${this.literal(cond.value)}`;
      case 'lt':
        return `${cond.column} < ${this.literal(cond.value)}`;
      case 'and':
        return `(${this.conditionToSQL(cond.left)} AND ${this.conditionToSQL(
          cond.right
        )})`;
      case 'or':
        return `(${this.conditionToSQL(cond.left)} OR ${this.conditionToSQL(
          cond.right
        )})`;
      default: {
        const _exhaustive: never = cond;
        return _exhaustive;
      }
    }
  }

  private literal(value: unknown): string {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value === null || value === undefined) return 'NULL';
    // naive string escaping for now
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private buildHints(options: BridgeOptions): string | '' {
    const lines: string[] = [];
    if (options.timeBlock) {
      lines.push(`@time(block => ${options.timeBlock.value})`);
    }
    if (options.route) {
      const lanePart = options.route.lane
        ? `, lane => '${options.route.lane}'`
        : '';
      lines.push(
        `@route(target => '${options.route.target}'${lanePart})`
      );
    }
    return lines.join('\n');
  }
}
