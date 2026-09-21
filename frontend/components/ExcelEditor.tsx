"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import {
  Save,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Trash2,
  Search,
  X,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { filesAPI } from "@/lib/api";
import { PaginatedData, Sheet, CellStyle, CellFormat } from "@/types";
import {
  CellValue,
  evaluateFormula,
  recalculateFormulas,
  indexToCol,
} from "@/lib/formulaEngine";
import {
  UndoRedoManager,
  CellChange,
  StructuralChange,
  HistoryEntry,
  applyUndoRedo,
} from "@/lib/history";

ModuleRegistry.registerModules([AllCommunityModule]);

interface Props {
  fileId: string;
  sheets: Sheet[];
  onSheetChange?: (sheetName: string) => void;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
  onDataChanged?: (data?: { columns: string[]; rows: unknown[][] }) => void;
}

export default function ExcelEditor({
  fileId,
  sheets,
  onSheetChange,
  onUnsavedChange,
  onDataChanged,
}: Props) {
  const [activeSheet, setActiveSheet] = useState(
    sheets[0]?.sheet_name || ""
  );
  const [data, setData] = useState<PaginatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [workingData, setWorkingData] = useState<CellValue[][]>([]);
  const [workingColumns, setWorkingColumns] = useState<string[]>([]);
  const [cellStyles, setCellStyles] = useState<CellStyle>({});

  const [historyManager] = useState(() => new UndoRedoManager());
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "row" | "column" | "cell";
    index?: number;
    columnName?: string;
  } | null>(null);

  const gridRef = useRef<AgGridReact>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(
    async (sheetName: string, pageNum: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await filesAPI.data(fileId, sheetName, pageNum, 1000);
        setData(res.data);
        const rows = res.data.rows.map((row: unknown[]) =>
          row.map((v) => (v === "" || v === null || v === undefined ? null : v as CellValue))
        );
        setWorkingData(rows);
        setWorkingColumns([...res.data.columns]);
        setHasUnsavedChanges(false);
        onUnsavedChange?.(false);
        historyManager.clear();
        setUndoCount(0);
        setRedoCount(0);
        onDataChanged?.({ columns: [...res.data.columns], rows: rows.map((r: CellValue[]) => [...r]) });
      } catch {
        setError("Failed to load spreadsheet data.");
      } finally {
        setLoading(false);
      }
    },
    [fileId, onUnsavedChange, historyManager, onDataChanged]
  );

  useEffect(() => {
    loadData(activeSheet, page);
  }, [activeSheet, page, loadData]);

  useEffect(() => {
    function handleClick() {
      setContextMenu(null);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const displayData = useMemo(() => {
    if (workingData.length === 0) return workingData;
    return recalculateFormulas(workingData, workingColumns);
  }, [workingData, workingColumns]);

  const getCellKey = (row: number, col: number) => `${row}:${col}`;

  function getCellStyle(row: number, col: number): CellFormat {
    return cellStyles[getCellKey(row, col)] || {};
  }

  function applyFormatToSelection(format: Partial<CellFormat>) {
    if (!selectedCell || !data) return;
    const col = indexToCol(selectedCell.col);
    const key = getCellKey(selectedCell.row, selectedCell.col);
    setCellStyles((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...format },
    }));
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: workingColumns, rows: workingData.map((r) => [...r]) });
  }

  function handleCellValueChanged(event: {
    data: Record<string, unknown>;
    colDef: { field?: string };
    newValue: unknown;
  }) {
    const col = event.colDef.field;
    if (!col || !data) return;

    const colIdx = workingColumns.indexOf(col);
    const rowEntries = Object.entries(event.data);
    let gridRowIdx = -1;
    for (let i = 0; i < rowData.length; i++) {
      if (rowData[i] === event.data) {
        gridRowIdx = i;
        break;
      }
    }
    if (gridRowIdx === -1) return;

    const globalRow = (page - 1) * 1000 + gridRowIdx;
    const oldValue = workingData[globalRow]?.[colIdx] ?? null;
    const newValueConverted: CellValue =
      event.newValue === "" || event.newValue === null || event.newValue === undefined
        ? null
        : event.newValue as CellValue;

    if (oldValue === newValueConverted) return;

    const newWorkingData = workingData.map((r) => [...r]);
    if (!newWorkingData[globalRow]) {
      while (newWorkingData.length <= globalRow) {
        newWorkingData.push(new Array(workingColumns.length).fill(null));
      }
    }
    newWorkingData[globalRow][colIdx] = newValueConverted;
    setWorkingData(newWorkingData);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: workingColumns, rows: newWorkingData.map((r) => [...r]) });

    const change: CellChange = {
      sheetName: activeSheet,
      row: globalRow,
      column: col,
      oldValue,
      newValue: newValueConverted,
    };
    historyManager.push({
      cellChanges: [change],
      structuralChanges: [],
      description: `Edit ${col}${globalRow + 1}`,
    });
    setUndoCount(historyManager.getUndoCount());
    setRedoCount(historyManager.getRedoCount());
  }

  function handleUndo() {
    const entry = historyManager.undo();
    if (!entry) return;
    const result = applyUndoRedo(entry, workingData, workingColumns);
    setWorkingData(result.data);
    setWorkingColumns(result.columns);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: result.columns, rows: result.data.map((r) => [...r]) });
    setUndoCount(historyManager.getUndoCount());
    setRedoCount(historyManager.getRedoCount());
  }

  function handleRedo() {
    const entry = historyManager.redo();
    if (!entry) return;
    const redoEntry: HistoryEntry = {
      cellChanges: entry.cellChanges.map((c) => ({
        ...c,
        oldValue: c.newValue,
        newValue: c.oldValue,
      })),
      structuralChanges: entry.structuralChanges.map((s) => {
        switch (s.type) {
          case "add_row":
            return { ...s, type: "delete_row" as const };
          case "delete_row":
            return { ...s, type: "add_row" as const };
          case "add_column":
            return { ...s, type: "delete_column" as const };
          case "delete_column":
            return { ...s, type: "add_column" as const };
          default:
            return s;
        }
      }),
      description: entry.description,
    };
    const result = applyUndoRedo(redoEntry, workingData, workingColumns);
    setWorkingData(result.data);
    setWorkingColumns(result.columns);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: result.columns, rows: result.data.map((r) => [...r]) });
    setUndoCount(historyManager.getUndoCount());
    setRedoCount(historyManager.getRedoCount());
  }

  function handleAddRow(atIndex?: number) {
    const idx = atIndex !== undefined ? atIndex : workingData.length;
    const newRow: CellValue[] = workingColumns.map(() => null);
    const newData = [...workingData];
    newData.splice(idx, 0, newRow);
    setWorkingData(newData);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: workingColumns, rows: newData.map((r) => [...r]) });

    const structural: StructuralChange = {
      type: "add_row",
      sheetName: activeSheet,
      index: idx,
    };
    historyManager.push({
      cellChanges: [],
      structuralChanges: [structural],
      description: `Add row at ${idx + 1}`,
    });
    setUndoCount(historyManager.getUndoCount());
  }

  function handleDeleteRow(rowIndex: number) {
    if (workingData.length <= 1) return;
    const deletedRow = workingData[rowIndex];
    const newData = [...workingData];
    newData.splice(rowIndex, 1);
    setWorkingData(newData);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: workingColumns, rows: newData.map((r) => [...r]) });

    const structural: StructuralChange = {
      type: "delete_row",
      sheetName: activeSheet,
      index: rowIndex,
      rowData: deletedRow,
    };
    historyManager.push({
      cellChanges: [],
      structuralChanges: [structural],
      description: `Delete row ${rowIndex + 1}`,
    });
    setUndoCount(historyManager.getUndoCount());
  }

  function handleAddColumn(atIndex?: number) {
    let colNum = workingColumns.length + 1;
    let newName = indexToCol(colNum - 1);
    while (workingColumns.includes(newName)) {
      colNum++;
      newName = indexToCol(colNum - 1);
    }
    const idx = atIndex !== undefined ? atIndex : workingColumns.length;
    const newColumns = [...workingColumns];
    newColumns.splice(idx, 0, newName);
    const newData = workingData.map((row) => {
      const newRow = [...row];
      newRow.splice(idx, 0, null);
      return newRow;
    });
    setWorkingColumns(newColumns);
    setWorkingData(newData);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: newColumns, rows: newData.map((r) => [...r]) });

    const structural: StructuralChange = {
      type: "add_column",
      sheetName: activeSheet,
      index: idx,
      newName,
    };
    historyManager.push({
      cellChanges: [],
      structuralChanges: [structural],
      description: `Add column ${newName}`,
    });
    setUndoCount(historyManager.getUndoCount());
  }

  function handleDeleteColumn(colName: string) {
    if (workingColumns.length <= 1) return;
    const idx = workingColumns.indexOf(colName);
    if (idx === -1) return;
    const deletedColData = workingData.map((row) => row[idx]);
    const newColumns = workingColumns.filter((c) => c !== colName);
    const newData = workingData.map((row) => {
      const newRow = [...row];
      newRow.splice(idx, 1);
      return newRow;
    });
    setWorkingColumns(newColumns);
    setWorkingData(newData);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: newColumns, rows: newData.map((r) => [...r]) });

    const structural: StructuralChange = {
      type: "delete_column",
      sheetName: activeSheet,
      index: idx,
      oldName: colName,
    };
    historyManager.push({
      cellChanges: [],
      structuralChanges: [structural],
      description: `Delete column ${colName}`,
    });
    setUndoCount(historyManager.getUndoCount());
  }

  function handleRenameColumn(oldName: string) {
    const newName = prompt(`Rename column "${oldName}" to:`, oldName);
    if (!newName || newName === oldName || workingColumns.includes(newName))
      return;
    const newColumns = workingColumns.map((c) =>
      c === oldName ? newName : c
    );
    setWorkingColumns(newColumns);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: newColumns, rows: workingData.map((r) => [...r]) });

    const structural: StructuralChange = {
      type: "rename_column",
      sheetName: activeSheet,
      oldName,
      newName,
    };
    historyManager.push({
      cellChanges: [],
      structuralChanges: [structural],
      description: `Rename ${oldName} to ${newName}`,
    });
    setUndoCount(historyManager.getUndoCount());
  }

  function handleCopy() {
    if (!selectedCell || !data) return;
    const col = workingColumns[selectedCell.col];
    const val = workingData[selectedCell.row]?.[selectedCell.col];
    if (val !== null && val !== undefined) {
      navigator.clipboard.writeText(String(val)).catch(() => {});
    }
  }

  function handleCut() {
    if (!selectedCell || !data) return;
    handleCopy();
    const colIdx = selectedCell.col;
    const globalRow = selectedCell.row;
    const oldVal = workingData[globalRow]?.[colIdx] ?? null;
    const newWorkingData = workingData.map((r) => [...r]);
    if (newWorkingData[globalRow]) {
      newWorkingData[globalRow][colIdx] = null;
    }
    setWorkingData(newWorkingData);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: workingColumns, rows: newWorkingData.map((r) => [...r]) });

    const change: CellChange = {
      sheetName: activeSheet,
      row: globalRow,
      column: workingColumns[colIdx],
      oldValue: oldVal,
      newValue: null,
    };
    historyManager.push({
      cellChanges: [change],
      structuralChanges: [],
      description: `Cut ${workingColumns[colIdx]}${globalRow + 1}`,
    });
    setUndoCount(historyManager.getUndoCount());
  }

  function handlePaste() {
    if (!selectedCell || !data) return;
    navigator.clipboard
      .readText()
      .then((text) => {
        const colIdx = selectedCell.col;
        const globalRow = selectedCell.row;
        const oldVal = workingData[globalRow]?.[colIdx] ?? null;
        let pasteVal: CellValue = text;
        const num = Number(text);
        if (!isNaN(num) && text.trim() !== "") pasteVal = num;

        const newWorkingData = workingData.map((r) => [...r]);
        if (!newWorkingData[globalRow]) {
          while (newWorkingData.length <= globalRow) {
            newWorkingData.push(new Array(workingColumns.length).fill(null));
          }
        }
        newWorkingData[globalRow][colIdx] = pasteVal;
        setWorkingData(newWorkingData);
        setHasUnsavedChanges(true);
        onUnsavedChange?.(true);
        onDataChanged?.({ columns: workingColumns, rows: newWorkingData.map((r) => [...r]) });

        const change: CellChange = {
          sheetName: activeSheet,
          row: globalRow,
          column: workingColumns[colIdx],
          oldValue: oldVal,
          newValue: pasteVal,
        };
        historyManager.push({
          cellChanges: [change],
          structuralChanges: [],
          description: `Paste to ${workingColumns[colIdx]}${globalRow + 1}`,
        });
        setUndoCount(historyManager.getUndoCount());
      })
      .catch(() => {});
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const changes: {
        sheet_name: string;
        row: number;
        column: string;
        value: unknown;
      }[] = [];
      const structural: {
        operation: string;
        sheet_name: string;
        index?: number;
        column_name?: string;
        new_name?: string;
      }[] = [];

      const origRes = await filesAPI.data(fileId, activeSheet, 1, 1000);
      const origData = origRes.data;
      const origColumns: string[] = origRes.data.columns;

      for (let r = 0; r < workingData.length; r++) {
        for (let c = 0; c < workingColumns.length; c++) {
          const newVal = workingData[r]?.[c] ?? null;
          let origVal: CellValue = null;

          const origColIdx = origColumns.indexOf(workingColumns[c]);
          if (origColIdx !== -1 && r < origData.rows.length) {
            origVal = origData.rows[r][origColIdx];
            if (origVal === "" || origVal === null || origVal === undefined)
              origVal = null;
          }

          const displayVal =
            typeof newVal === "string" && newVal.startsWith("=")
              ? evaluateFormula(newVal, workingData, workingColumns)
              : newVal;

          const displayOrig =
            typeof origVal === "string" && origVal.startsWith("=")
              ? evaluateFormula(origVal, origData.rows, origColumns)
              : origVal;

          if (String(displayVal) !== String(displayOrig)) {
            changes.push({
              sheet_name: activeSheet,
              row: r,
              column: workingColumns[c],
              value: newVal,
            });
          }
        }
      }

      if (workingColumns.length > origColumns.length) {
        for (
          let c = origColumns.length;
          c < workingColumns.length;
          c++
        ) {
          structural.push({
            operation: "add_column",
            sheet_name: activeSheet,
            index: c,
            column_name: workingColumns[c],
          });
        }
      }

      const removedCols = origColumns.filter(
        (c) => !workingColumns.includes(c)
      );
      for (const col of removedCols) {
        structural.push({
          operation: "delete_column",
          sheet_name: activeSheet,
          column_name: col,
        });
      }

      if (workingData.length > origData.rows.length) {
        for (
          let r = origData.rows.length;
          r < workingData.length;
          r++
        ) {
          structural.push({
            operation: "add_row",
            sheet_name: activeSheet,
            index: r,
          });
          for (let c = 0; c < workingColumns.length; c++) {
            const val = workingData[r]?.[c];
            if (val !== null && val !== undefined && val !== "") {
              changes.push({
                sheet_name: activeSheet,
                row: r,
                column: workingColumns[c],
                value: val,
              });
            }
          }
        }
      } else if (workingData.length < origData.rows.length) {
        for (
          let r = origData.rows.length - 1;
          r >= workingData.length;
          r--
        ) {
          structural.push({
            operation: "delete_row",
            sheet_name: activeSheet,
            index: r,
          });
        }
      }

      if (changes.length > 0 || structural.length > 0) {
        const versionRes = await filesAPI.getVersion(fileId);
        const currentVersion = versionRes.data.dataset_version;
        try {
          await filesAPI.saveData(fileId, { changes, structural, dataset_version: currentVersion });
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'response' in err) {
            const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
            if (axiosErr.response?.status === 409) {
              setError("Conflict detected: Another user modified this data. Reloading...");
              await loadData(activeSheet, page);
              return;
            }
          }
          throw err;
        }
      }

      setHasUnsavedChanges(false);
      onUnsavedChange?.(false);
      onDataChanged?.({ columns: workingColumns, rows: workingData });
      await loadData(activeSheet, page);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const columnDefs = useMemo(
    () =>
      workingColumns.map((col, idx) => ({
        headerName: col,
        field: col,
        editable: true,
        flex: 1,
        minWidth: 100,
        comparator: (a: unknown, b: unknown) => {
          const numA = Number(a);
          const numB = Number(b);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return String(a).localeCompare(String(b));
        },
        cellStyle: (params: { rowIndex: number }) => {
          const rowIdx = (page - 1) * 1000 + params.rowIndex;
          const fmt = getCellStyle(rowIdx, idx);
          const isModified = historyManager.hasModification(rowIdx, col);
          const style: Record<string, string> = {};
          if (fmt.bold) style.fontWeight = "bold";
          if (fmt.italic) style.fontStyle = "italic";
          if (fmt.underline) style.textDecoration = "underline";
          if (fmt.textAlign) style.textAlign = fmt.textAlign;
          if (isModified) {
            style.backgroundColor = "rgba(59, 130, 246, 0.08)";
          }
          return Object.keys(style).length > 0 ? style : undefined;
        },
      })),
    [workingColumns, page, cellStyles]
  );

  const rowData = useMemo(
    () =>
      displayData.map((row) => {
        const obj: Record<string, CellValue> = {};
        workingColumns.forEach((col, i) => {
          const val = row[i];
          obj[col] = val === undefined ? null : val;
        });
        return obj;
      }),
    [displayData, workingColumns]
  );

  const filteredRowData = useMemo(() => {
    if (!searchValue.trim()) return rowData;
    const term = searchValue.toLowerCase();
    return rowData.filter((row) =>
      Object.values(row).some(
        (v) => v !== null && String(v).toLowerCase().includes(term)
      )
    );
  }, [rowData, searchValue]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      handleRedo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      e.preventDefault();
      handleCopy();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "x") {
      e.preventDefault();
      handleCut();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
      handlePaste();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      setShowSearch(true);
    }
    if (e.key === "Escape") {
      setShowSearch(false);
      setSearchValue("");
    }
  }

  function handleFormulaBarSubmit() {
    if (!selectedCell || !data) return;
    const colIdx = selectedCell.col;
    const globalRow = selectedCell.row;
    const oldVal = workingData[globalRow]?.[colIdx] ?? null;
    let newVal: CellValue = formulaBarValue;
    const num = Number(formulaBarValue);
    if (!isNaN(num) && formulaBarValue.trim() !== "") newVal = num;

    const newWorkingData = workingData.map((r) => [...r]);
    if (!newWorkingData[globalRow]) {
      while (newWorkingData.length <= globalRow) {
        newWorkingData.push(new Array(workingColumns.length).fill(null));
      }
    }
    newWorkingData[globalRow][colIdx] = newVal;
    setWorkingData(newWorkingData);
    setHasUnsavedChanges(true);
    onUnsavedChange?.(true);
    onDataChanged?.({ columns: workingColumns, rows: newWorkingData.map((r) => [...r]) });

    const change: CellChange = {
      sheetName: activeSheet,
      row: globalRow,
      column: workingColumns[colIdx],
      oldValue: oldVal,
      newValue: newVal,
    };
    historyManager.push({
      cellChanges: [change],
      structuralChanges: [],
      description: `Edit ${workingColumns[colIdx]}${globalRow + 1}`,
    });
    setUndoCount(historyManager.getUndoCount());
  }

  function handleCellClicked(event: { rowIndex?: number | null; colDef?: { field?: string } }) {
    if (event.rowIndex == null || !event.colDef?.field) return;
    const colIdx = workingColumns.indexOf(event.colDef.field);
    const globalRow = (page - 1) * 1000 + event.rowIndex;
    setSelectedCell({ row: globalRow, col: colIdx });
    const val = workingData[globalRow]?.[colIdx];
    setFormulaBarValue(val !== null && val !== undefined ? String(val) : "");
  }

  function handleContextMenu(
    e: React.MouseEvent,
    type: "row" | "column" | "cell",
    index?: number,
    columnName?: string
  ) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, index, columnName });
  }

  return (
    <div
      className="flex flex-col h-full"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1.5 bg-gray-800 border-b border-gray-700 flex-wrap">
        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 border-r border-gray-700 pr-2 mr-1">
          <button
            onClick={handleUndo}
            disabled={!historyManager.canUndo()}
            className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!historyManager.canRedo()}
            className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Formatting */}
        <div className="flex items-center gap-0.5 border-r border-gray-700 pr-2 mr-1">
          <button
            onClick={() => applyFormatToSelection({ bold: !getCellStyle(selectedCell?.row ?? 0, selectedCell?.col ?? 0).bold })}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => applyFormatToSelection({ italic: !getCellStyle(selectedCell?.row ?? 0, selectedCell?.col ?? 0).italic })}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => applyFormatToSelection({ underline: !getCellStyle(selectedCell?.row ?? 0, selectedCell?.col ?? 0).underline })}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-0.5 border-r border-gray-700 pr-2 mr-1">
          <button
            onClick={() => applyFormatToSelection({ textAlign: "left" })}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => applyFormatToSelection({ textAlign: "center" })}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => applyFormatToSelection({ textAlign: "right" })}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Row/Column Operations */}
        <div className="flex items-center gap-0.5 border-r border-gray-700 pr-2 mr-1">
          <button
            onClick={() => handleAddRow()}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Add Row"
          >
            <Plus className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => handleAddColumn()}
            className="p-1.5 rounded hover:bg-gray-700"
            title="Add Column"
          >
            <Plus className="w-4 h-4 text-gray-300 rotate-90" />
          </button>
        </div>

        {/* Search Toggle */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-1.5 rounded ${showSearch ? "bg-blue-600" : "hover:bg-gray-700"}`}
          title="Search (Ctrl+F)"
        >
          <Search className="w-4 h-4 text-gray-300" />
        </button>

        {/* Cell Reference */}
        {selectedCell && (
          <div className="flex items-center gap-1 ml-2 text-xs text-gray-400">
            <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded">
              {indexToCol(selectedCell.col)}
              {selectedCell.row + 1}
            </span>
          </div>
        )}

        {/* Unsaved Indicator */}
        <div className="ml-auto flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertCircle className="w-3 h-3" />
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 border-b border-gray-700">
        {selectedCell && (
          <span className="text-xs font-mono text-blue-400 bg-gray-700 px-2 py-1 rounded min-w-[50px] text-center">
            {indexToCol(selectedCell.col)}
            {selectedCell.row + 1}
          </span>
        )}
        <span className="text-xs text-gray-500">fx</span>
        <input
          ref={formulaInputRef}
          type="text"
          value={formulaBarValue}
          onChange={(e) => setFormulaBarValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleFormulaBarSubmit();
            }
          }}
          className="flex-1 bg-gray-900 text-sm text-white px-2 py-1 rounded border border-gray-700 focus:border-blue-500 focus:outline-none font-mono"
          placeholder="Enter value or formula (e.g. =SUM(A1:A10))"
        />
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 border-b border-gray-700">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="flex-1 bg-gray-900 text-sm text-white px-2 py-1 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            placeholder="Search cells..."
            autoFocus
          />
          {searchValue && (
            <span className="text-xs text-gray-400">
              {filteredRowData.length} of {rowData.length} rows
            </span>
          )}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchValue("");
            }}
            className="p-1 rounded hover:bg-gray-700"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-300">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sheet Tabs */}
      <div className="flex items-center gap-1 p-1.5 bg-gray-800 border-b border-gray-700">
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            onClick={() => {
              if (hasUnsavedChanges) {
                if (!confirm("You have unsaved changes. Switch sheet anyway?"))
                  return;
              }
              setActiveSheet(sheet.sheet_name);
              setPage(1);
              onSheetChange?.(sheet.sheet_name);
            }}
            className={`px-3 py-1 text-sm rounded ${
              activeSheet === sheet.sheet_name
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {sheet.sheet_name}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-gray-500">
          {workingData.length} rows x {workingColumns.length} cols
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 ag-theme-alpine-dark overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <AgGridReact
            ref={gridRef}
            columnDefs={columnDefs}
            rowData={filteredRowData}
            onCellValueChanged={handleCellValueChanged}
            onCellClicked={handleCellClicked}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              editable: true,
            }}
            animateRows={true}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            enableCellTextSelection={true}
            ensureDomOrder={true}
          />
        )}
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between p-2 bg-gray-800 border-t border-gray-700">
          <span className="text-sm text-gray-400">
            Page {data.page} of {data.total_pages} ({data.total_rows} rows)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
              disabled={page === data.total_pages}
              className="p-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "row" && contextMenu.index !== undefined && (
            <>
              <button
                onClick={() => {
                  handleAddRow(contextMenu.index);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                <Plus className="w-3 h-3 inline mr-2" />
                Insert row above
              </button>
              <button
                onClick={() => {
                  handleAddRow(contextMenu.index! + 1);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                <Plus className="w-3 h-3 inline mr-2" />
                Insert row below
              </button>
              <hr className="border-gray-700 my-1" />
              <button
                onClick={() => {
                  handleDeleteRow(contextMenu.index!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700"
              >
                <Trash2 className="w-3 h-3 inline mr-2" />
                Delete row
              </button>
            </>
          )}
          {contextMenu.type === "column" && contextMenu.columnName && (
            <>
              <button
                onClick={() => {
                  const idx = workingColumns.indexOf(contextMenu.columnName!);
                  handleAddColumn(idx);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                <Plus className="w-3 h-3 inline mr-2" />
                Insert column left
              </button>
              <button
                onClick={() => {
                  const idx = workingColumns.indexOf(contextMenu.columnName!);
                  handleAddColumn(idx + 1);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                <Plus className="w-3 h-3 inline mr-2" />
                Insert column right
              </button>
              <hr className="border-gray-700 my-1" />
              <button
                onClick={() => {
                  handleRenameColumn(contextMenu.columnName!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                <Pencil className="w-3 h-3 inline mr-2" />
                Rename column
              </button>
              <button
                onClick={() => {
                  handleDeleteColumn(contextMenu.columnName!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700"
              >
                <Trash2 className="w-3 h-3 inline mr-2" />
                Delete column
              </button>
            </>
          )}
          {contextMenu.type === "cell" && (
            <>
              <button
                onClick={() => {
                  handleCopy();
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                Copy
              </button>
              <button
                onClick={() => {
                  handleCut();
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                Cut
              </button>
              <button
                onClick={() => {
                  handlePaste();
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                Paste
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
