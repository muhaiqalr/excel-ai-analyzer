export type CellValue = string | number | boolean | null;

function colToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1;
}

function indexToCol(index: number): string {
  let col = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function parseCellRef(ref: string): { col: string; row: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: match[1], row: parseInt(match[2], 10) - 1 };
}

function parseRange(range: string): { col: string; row: number }[] | null {
  const parts = range.split(":");
  if (parts.length !== 2) return null;
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return null;

  const cells: { col: string; row: number }[] = [];
  const startCol = colToIndex(start.col);
  const endCol = colToIndex(end.col);
  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      cells.push({ col: indexToCol(c), row: r });
    }
  }
  return cells;
}

function resolveArg(
  arg: string,
  data: CellValue[][],
  columns: string[]
): CellValue[] {
  const trimmed = arg.trim();

  if (trimmed.includes(":")) {
    const cells = parseRange(trimmed);
    if (!cells) return [];
    return cells
      .map((c) => {
        const colIdx = columns.indexOf(c.col);
        if (colIdx === -1 || c.row < 0 || c.row >= data.length) return null;
        return data[c.row]?.[colIdx] ?? null;
      })
      .filter((v) => v !== null && v !== "" && v !== undefined);
  }

  const cellRef = parseCellRef(trimmed);
  if (cellRef) {
    const colIdx = columns.indexOf(cellRef.col);
    if (colIdx === -1 || cellRef.row < 0 || cellRef.row >= data.length)
      return [];
    const val = data[cellRef.row]?.[colIdx] ?? null;
    return val !== null && val !== undefined && val !== "" ? [val] : [];
  }

  const num = Number(trimmed);
  if (!isNaN(num)) return [num];

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return [trimmed.slice(1, -1)];
  }

  return [];
}

function resolveNumericArg(
  arg: string,
  data: CellValue[][],
  columns: string[]
): number[] {
  return resolveArg(arg, data, columns)
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((v) => !isNaN(v));
}

function evaluateFunction(
  funcName: string,
  argsStr: string,
  data: CellValue[][],
  columns: string[]
): CellValue {
  const args = splitArgs(argsStr);
  const name = funcName.toUpperCase();

  switch (name) {
    case "SUM": {
      let total = 0;
      for (const arg of args) {
        const nums = resolveNumericArg(arg, data, columns);
        total += nums.reduce((a, b) => a + b, 0);
      }
      return total;
    }
    case "AVERAGE": {
      const allNums: number[] = [];
      for (const arg of args) {
        allNums.push(...resolveNumericArg(arg, data, columns));
      }
      return allNums.length > 0
        ? allNums.reduce((a, b) => a + b, 0) / allNums.length
        : 0;
    }
    case "COUNT": {
      let count = 0;
      for (const arg of args) {
        const vals = resolveArg(arg, data, columns);
        count += vals.filter((v) => typeof v === "number" && !isNaN(v)).length;
      }
      return count;
    }
    case "COUNTA": {
      let count = 0;
      for (const arg of args) {
        const vals = resolveArg(arg, data, columns);
        count += vals.length;
      }
      return count;
    }
    case "MIN": {
      const allNums: number[] = [];
      for (const arg of args) {
        allNums.push(...resolveNumericArg(arg, data, columns));
      }
      return allNums.length > 0 ? Math.min(...allNums) : 0;
    }
    case "MAX": {
      const allNums: number[] = [];
      for (const arg of args) {
        allNums.push(...resolveNumericArg(arg, data, columns));
      }
      return allNums.length > 0 ? Math.max(...allNums) : 0;
    }
    case "ROUND": {
      if (args.length < 1) return 0;
      const numVals = resolveNumericArg(args[0], data, columns);
      const num = numVals.length > 0 ? numVals[0] : 0;
      const decimals =
        args.length > 1 ? resolveNumericArg(args[1], data, columns)[0] || 0 : 0;
      const factor = Math.pow(10, decimals);
      return Math.round(num * factor) / factor;
    }
    case "IF": {
      if (args.length < 2) return "#VALUE!";
      const condition = evaluateExpression(args[0], data, columns);
      if (condition) {
        return evaluateExpression(args[1], data, columns);
      }
      return args.length > 2 ? evaluateExpression(args[2], data, columns) : false;
    }
    case "AND": {
      for (const arg of args) {
        const val = evaluateExpression(arg, data, columns);
        if (!val) return false;
      }
      return true;
    }
    case "OR": {
      for (const arg of args) {
        const val = evaluateExpression(arg, data, columns);
        if (val) return true;
      }
      return false;
    }
    default:
      return `#NAME?`;
  }
}

function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];

    if (inString) {
      current += ch;
      if (ch === stringChar && argsStr[i - 1] !== "\\") inString = false;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function evaluateComparison(
  left: CellValue,
  op: string,
  right: CellValue
): boolean {
  const l = typeof left === "number" ? left : Number(left);
  const r = typeof right === "number" ? right : Number(right);
  const useNumeric = !isNaN(l) && !isNaN(r);

  switch (op) {
    case ">":
      return useNumeric ? l > r : String(left) > String(right);
    case ">=":
      return useNumeric ? l >= r : String(left) >= String(right);
    case "<":
      return useNumeric ? l < r : String(left) < String(right);
    case "<=":
      return useNumeric ? l <= r : String(left) <= String(right);
    case "=":
    case "==":
      return useNumeric ? l === r : String(left) === String(right);
    case "!=":
    case "<>":
      return useNumeric ? l !== r : String(left) !== String(right);
    default:
      return false;
  }
}

function evaluateExpression(
  expr: string,
  data: CellValue[][],
  columns: string[]
): CellValue {
  const trimmed = expr.trim();

  const funcMatch = trimmed.match(/^([A-Z]+)\(([\s\S]*)\)$/);
  if (funcMatch) {
    return evaluateFunction(funcMatch[1], funcMatch[2], data, columns);
  }

  const comparisons = [">=", "<=", "!=", "<>", ">", "<", "=", "=="];
  for (const op of comparisons) {
    const idx = findComparisonOp(trimmed, op);
    if (idx !== -1) {
      const left = evaluateExpression(trimmed.substring(0, idx), data, columns);
      const right = evaluateExpression(
        trimmed.substring(idx + op.length),
        data,
        columns
      );
      return evaluateComparison(left, op, right);
    }
  }

  const andIdx = findWordOp(trimmed, " AND ");
  if (andIdx !== -1) {
    const left = evaluateExpression(trimmed.substring(0, andIdx), data, columns);
    const right = evaluateExpression(
      trimmed.substring(andIdx + 5),
      data,
      columns
    );
    return Boolean(left) && Boolean(right);
  }

  const orIdx = findWordOp(trimmed, " OR ");
  if (orIdx !== -1) {
    const left = evaluateExpression(trimmed.substring(0, orIdx), data, columns);
    const right = evaluateExpression(
      trimmed.substring(orIdx + 4),
      data,
      columns
    );
    return Boolean(left) || Boolean(right);
  }

  if (trimmed === "TRUE") return true;
  if (trimmed === "FALSE") return false;

  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== "") return num;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  const cellRef = parseCellRef(trimmed);
  if (cellRef) {
    const colIdx = columns.indexOf(cellRef.col);
    if (colIdx !== -1 && cellRef.row >= 0 && cellRef.row < data.length) {
      return data[cellRef.row]?.[colIdx] ?? null;
    }
    return null;
  }

  return trimmed;
}

function findComparisonOp(expr: string, op: string): number {
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inString) {
      if (ch === stringChar && expr[i - 1] !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    } else if (depth === 0 && expr.substring(i, i + op.length) === op) {
      if (op.length === 1 && (ch === ">" || ch === "<" || ch === "=")) {
        return i;
      }
      if (op.length === 2 || op.length === 1) {
        return i;
      }
    }
  }
  return -1;
}

function findWordOp(expr: string, op: string): number {
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inString) {
      if (ch === stringChar && expr[i - 1] !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    } else if (
      depth === 0 &&
      expr.substring(i, i + op.length).toUpperCase() === op
    ) {
      return i;
    }
  }
  return -1;
}

export function evaluateFormula(
  formula: string,
  data: CellValue[][],
  columns: string[]
): CellValue {
  if (!formula.startsWith("=")) return formula;

  const expr = formula.substring(1).trim();
  return evaluateExpression(expr, data, columns);
}

export function recalculateFormulas(
  rows: CellValue[][],
  columns: string[]
): CellValue[][] {
  const result = rows.map((row) => [...row]);
  const maxIterations = rows.length * columns.length;
  let changed = true;
  let iterations = 0;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (let r = 0; r < result.length; r++) {
      for (let c = 0; c < columns.length; c++) {
        const val = result[r][c];
        if (typeof val === "string" && val.startsWith("=")) {
          const newVal = evaluateFormula(val, result, columns);
          if (newVal !== val) {
            result[r][c] = newVal;
            changed = true;
          }
        }
      }
    }
  }

  return result;
}

export { indexToCol, colToIndex };
