import { CellValue } from "./formulaEngine";

export interface CellChange {
  sheetName: string;
  row: number;
  column: string;
  oldValue: CellValue;
  newValue: CellValue;
}

export interface StructuralChange {
  type: "add_row" | "delete_row" | "add_column" | "delete_column" | "rename_column";
  sheetName: string;
  index?: number;
  oldName?: string;
  newName?: string;
  rowData?: CellValue[];
}

export interface HistoryEntry {
  cellChanges: CellChange[];
  structuralChanges: StructuralChange[];
  description: string;
}

export class UndoRedoManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxSize = 100;

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return entry;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  hasModification(row: number, column: string): boolean {
    for (const entry of this.undoStack) {
      for (const change of entry.cellChanges) {
        if (change.row === row && change.column === column) {
          return true;
        }
      }
    }
    return false;
  }
}

export function applyUndoRedo(
  entry: HistoryEntry,
  currentData: CellValue[][],
  columns: string[]
): { data: CellValue[][]; columns: string[] } {
  let newData = currentData.map((row) => [...row]);
  let newColumns = [...columns];

  for (const change of entry.structuralChanges) {
    switch (change.type) {
      case "add_row":
        if (change.index !== undefined) {
          const newRow: CellValue[] = newColumns.map(() => "");
          newData.splice(change.index, 0, newRow);
        }
        break;
      case "delete_row":
        if (change.index !== undefined) {
          newData.splice(change.index, 1);
        }
        break;
      case "add_column":
        if (change.index !== undefined && change.newName) {
          newColumns.splice(change.index, 0, change.newName);
          newData = newData.map((row) => {
            const newRow = [...row];
            newRow.splice(change.index!, 0, "");
            return newRow;
          });
        }
        break;
      case "delete_column":
        if (change.index !== undefined) {
          newColumns.splice(change.index, 1);
          newData = newData.map((row) => {
            const newRow = [...row];
            newRow.splice(change.index!, 1);
            return newRow;
          });
        }
        break;
      case "rename_column":
        if (change.oldName && change.newName) {
          const idx = newColumns.indexOf(change.oldName);
          if (idx !== -1) newColumns[idx] = change.newName;
        }
        break;
    }
  }

  for (const change of entry.cellChanges) {
    const colIdx = newColumns.indexOf(change.column);
    if (colIdx !== -1 && change.row >= 0 && change.row < newData.length) {
      newData[change.row][colIdx] = change.oldValue;
    }
  }

  return { data: newData, columns: newColumns };
}
