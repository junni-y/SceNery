import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  ProjectData,
  Cell,
  Row,
  Column,
  FreeCell,
  Connection,
  AnchorPosition,
  UndoItem,
  PaintContent,
  TextContent
} from '../types';
import { db } from '../db/database';

interface FormatPainterState {
  active: boolean;
  locked: boolean;
  styleHtmlTemplate: string;
  backgroundColor?: string;
}

interface EditorState {
  currentProject: Project | null;
  undoStack: UndoItem[];
  redoStack: UndoItem[];

  // 交互选择态
  selectedTableCells: string[]; // `${rowId}-${colId}`
  selectedFreeCellIds: string[];
  selectedConnectionId: string | null;
  tableSearchQuery: string;

  // 格式刷
  formatPainter: FormatPainterState;

  // 绘画弹窗与大图查看器
  viewingPaintCell: { id: string; isFree: boolean; content: PaintContent } | null;
  editingPaintCell: { id: string; isFree: boolean; content: PaintContent } | null;

  // 初始化与持久化
  openProject: (projectId: string) => Promise<void>;
  saveProject: () => Promise<void>;
  updateProjectName: (name: string) => void;

  // 撤销/重做核心
  commitChange: (
    type: 'structure' | 'content',
    action: string,
    mutator: (draft: ProjectData) => void
  ) => void;
  undo: () => void;
  redo: () => void;

  // 视口操作
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  toggleGrid: () => void;
  toggleGridSnap: () => void;
  moveTablePosition: (x: number, y: number) => void;

  // 表格行列操作
  insertRows: (index: number, count: number) => void;
  deleteRows: (rowIds: string[]) => void;
  duplicateRow: (rowId: string) => void;
  reorderRows: (fromIndex: number, toIndex: number, mode: 'insert' | 'swap') => void;
  resizeRow: (rowId: string, height: number, applyToAll: boolean) => void;

  insertColumn: (index: number, type: 'text' | 'paint') => void;
  deleteColumn: (colId: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  resizeColumn: (colId: string, width: number) => void;

  // 单元格内容与合并
  updateCellContent: (rowId: string, colId: string, content: TextContent | PaintContent) => void;
  updateCellBackground: (rowId: string, colId: string, color: string) => void;
  mergeSelectedCells: () => void;
  selectTableCell: (key: string, multi: boolean) => void;
  setTableSearchQuery: (q: string) => void;

  // 格式刷
  activateFormatPainter: (locked: boolean, bg?: string) => void;
  deactivateFormatPainter: () => void;

  // 自由单元格与磁吸系统
  detachCellToCanvas: (rowId: string, colId: string, x: number, y: number) => void;
  attachFreeCellToTable: (
    freeCellId: string,
    target:
      | { kind: 'cell'; rowId: string; colId: string }
      | { kind: 'edge'; edge: 'top' | 'bottom' | 'left' | 'right'; rowId?: string; colId?: string }
  ) => void;
  moveFreeCells: (ids: string[], dx: number, dy: number) => void;
  resizeFreeCell: (id: string, width: number, height: number) => void;
  updateFreeCellContent: (id: string, content: TextContent | PaintContent) => void;
  updateFreeCellsBackground: (ids: string[], color: string) => void;
  deleteFreeCells: (ids: string[]) => void;
  stackFreeCells: (sourceId: string, targetId: string) => void;
  toggleStackExpand: (stackGroup: string) => void;
  extractFromStack: (freeCellId: string) => void;
  setSelectedFreeCells: (ids: string[]) => void;

  // 连线系统
  addConnection: (
    fromCellId: string,
    fromAnchor: AnchorPosition,
    toCellId: string,
    toAnchor: AnchorPosition
  ) => void;
  batchConnectFreeCells: (toCellId: string, toAnchor: AnchorPosition) => void;
  updateConnection: (id: string, patch: Partial<Connection>) => void;
  deleteConnection: (id: string) => void;
  setSelectedConnection: (id: string | null) => void;

  // 绘画弹窗控制
  setViewingPaintCell: (item: { id: string; isFree: boolean; content: PaintContent } | null) => void;
  setEditingPaintCell: (item: { id: string; isFree: boolean; content: PaintContent } | null) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentProject: null,
  undoStack: [],
  redoStack: [],
  selectedTableCells: [],
  selectedFreeCellIds: [],
  selectedConnectionId: null,
  tableSearchQuery: '',
  formatPainter: { active: false, locked: false, styleHtmlTemplate: '' },
  viewingPaintCell: null,
  editingPaintCell: null,

  openProject: async (projectId) => {
    const project = await db.projects.get(projectId);
    if (project) {
      set({
        currentProject: project,
        undoStack: [],
        redoStack: [],
        selectedTableCells: [],
        selectedFreeCellIds: [],
        selectedConnectionId: null
      });
    }
  },

  saveProject: async () => {
    const { currentProject } = get();
    if (!currentProject) return;
    // 自动将首张有图的绘画单元格设为默认封面（若无手动封面）
    let cover = currentProject.coverImage;
    if (!cover) {
      const firstPaint = Object.values(currentProject.data.table.cells).find(
        c => c.type === 'paint' && (c.content as PaintContent).thumbnail
      );
      if (firstPaint) {
        cover = (firstPaint.content as PaintContent).thumbnail;
      }
    }
    const updated: Project = {
      ...currentProject,
      coverImage: cover,
      updatedAt: Date.now()
    };
    await db.projects.put(updated);
    set({ currentProject: updated });
  },

  updateProjectName: (name) => {
    const { currentProject } = get();
    if (!currentProject) return;
    set({ currentProject: { ...currentProject, name } });
    get().saveProject();
  },

  commitChange: (type, action, mutator) => {
    const { currentProject, undoStack } = get();
    if (!currentProject) return;

    const beforeStr = JSON.stringify(currentProject.data);
    const draft: ProjectData = JSON.parse(beforeStr);
    mutator(draft);
    const afterStr = JSON.stringify(draft);

    if (beforeStr === afterStr) return;

    const item: UndoItem = {
      type,
      action,
      before: beforeStr,
      after: afterStr,
      timestamp: Date.now()
    };

    const nextProject: Project = {
      ...currentProject,
      data: draft,
      updatedAt: Date.now()
    };

    set({
      currentProject: nextProject,
      undoStack: [...undoStack.slice(-49), item],
      redoStack: []
    });

    get().saveProject();
  },

  undo: () => {
    const { currentProject, undoStack, redoStack } = get();
    if (!currentProject || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    const restoredData: ProjectData = JSON.parse(last.before);

    set({
      currentProject: { ...currentProject, data: restoredData },
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, last]
    });
    get().saveProject();
  },

  redo: () => {
    const { currentProject, undoStack, redoStack } = get();
    if (!currentProject || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const restoredData: ProjectData = JSON.parse(next.after);

    set({
      currentProject: { ...currentProject, data: restoredData },
      undoStack: [...undoStack, next],
      redoStack: redoStack.slice(0, -1)
    });
    get().saveProject();
  },

  setZoom: (zoom) => {
    const { currentProject } = get();
    if (!currentProject) return;
    const clamped = Math.max(0.1, Math.min(5, zoom));
    set({
      currentProject: {
        ...currentProject,
        data: {
          ...currentProject.data,
          canvas: { ...currentProject.data.canvas, zoom: clamped }
        }
      }
    });
  },

  setPan: (panX, panY) => {
    const { currentProject } = get();
    if (!currentProject) return;
    set({
      currentProject: {
        ...currentProject,
        data: {
          ...currentProject.data,
          canvas: { ...currentProject.data.canvas, panX, panY }
        }
      }
    });
  },

  toggleGrid: () => {
    const { currentProject } = get();
    if (!currentProject) return;
    set({
      currentProject: {
        ...currentProject,
        data: {
          ...currentProject.data,
          canvas: {
            ...currentProject.data.canvas,
            showGrid: !currentProject.data.canvas.showGrid
          }
        }
      }
    });
  },

  toggleGridSnap: () => {
    const { currentProject } = get();
    if (!currentProject) return;
    set({
      currentProject: {
        ...currentProject,
        data: {
          ...currentProject.data,
          canvas: {
            ...currentProject.data.canvas,
            gridSnap: !currentProject.data.canvas.gridSnap
          }
        }
      }
    });
  },

  moveTablePosition: (x, y) => {
    const { currentProject } = get();
    if (!currentProject) return;
    const dx = x - currentProject.data.table.x;
    const dy = y - currentProject.data.table.y;

    // 表格移动时，吸附在边缘的自由单元格跟着走（鮣鱼效应）
    const nextFreeCells = currentProject.data.canvas.freeCells.map(fc =>
      fc.attachedTo !== 'none' ? { ...fc, x: fc.x + dx, y: fc.y + dy } : fc
    );

    set({
      currentProject: {
        ...currentProject,
        data: {
          ...currentProject.data,
          table: { ...currentProject.data.table, x, y },
          canvas: { ...currentProject.data.canvas, freeCells: nextFreeCells }
        }
      }
    });
  },

  insertRows: (index, count) => {
    get().commitChange('structure', '插入行', draft => {
      const newRows: Row[] = [];
      for (let i = 0; i < count; i++) {
        const rowId = uuidv4();
        newRows.push({ id: rowId, height: 160, isHeader: false });
        draft.table.columns.forEach(col => {
          draft.table.cells[`${rowId}-${col.id}`] = {
            id: uuidv4(),
            rowId,
            colId: col.id,
            type: col.type,
            content:
              col.type === 'paint'
                ? { thumbnail: '', fullImage: '', canvasWidth: 800, canvasHeight: 450, aspectRatio: '16:9' }
                : { html: '', plainText: '' }
          };
        });
      }
      draft.table.rows.splice(index, 0, ...newRows);
      draft.table.mergedCells = [];
    });
  },

  deleteRows: (rowIds) => {
    get().commitChange('structure', '删除行', draft => {
      const deletedCellIds = new Set<string>();
      rowIds.forEach(rId => {
        draft.table.columns.forEach(c => {
          const cell = draft.table.cells[`${rId}-${c.id}`];
          if (cell) deletedCellIds.add(cell.id);
          delete draft.table.cells[`${rId}-${c.id}`];
        });
      });
      draft.table.rows = draft.table.rows.filter(r => !rowIds.includes(r.id) || r.isHeader);
      draft.table.mergedCells = [];
      draft.canvas.connections = draft.canvas.connections.filter(
        conn => !deletedCellIds.has(conn.fromCellId) && !deletedCellIds.has(conn.toCellId)
      );
    });
  },

  duplicateRow: (rowId) => {
    get().commitChange('structure', '复制行', draft => {
      const idx = draft.table.rows.findIndex(r => r.id === rowId);
      if (idx === -1) return;
      const origRow = draft.table.rows[idx];
      const newRowId = uuidv4();
      const newRow: Row = { ...origRow, id: newRowId, isHeader: false };
      draft.table.columns.forEach(col => {
        const origCell = draft.table.cells[`${rowId}-${col.id}`];
        draft.table.cells[`${newRowId}-${col.id}`] = {
          id: uuidv4(),
          rowId: newRowId,
          colId: col.id,
          type: col.type,
          backgroundColor: origCell?.backgroundColor,
          content: origCell
            ? JSON.parse(JSON.stringify(origCell.content))
            : col.type === 'paint'
            ? { thumbnail: '', fullImage: '', canvasWidth: 800, canvasHeight: 450, aspectRatio: '16:9' }
            : { html: '', plainText: '' }
        };
      });
      draft.table.rows.splice(idx + 1, 0, newRow);
    });
  },

  reorderRows: (fromIndex, toIndex, mode) => {
    get().commitChange('structure', '拖拽重排行', draft => {
      // 标题行受保护不可拖拽移动
      if (draft.table.rows[fromIndex]?.isHeader || draft.table.rows[toIndex]?.isHeader) return;
      // 拖拽行时自动拆开合并单元格
      draft.table.mergedCells = [];
      Object.values(draft.table.cells).forEach(c => delete c.mergedFrom);

      if (mode === 'swap') {
        const temp = draft.table.rows[fromIndex];
        draft.table.rows[fromIndex] = draft.table.rows[toIndex];
        draft.table.rows[toIndex] = temp;
      } else {
        const [moved] = draft.table.rows.splice(fromIndex, 1);
        draft.table.rows.splice(toIndex, 0, moved);
      }
    });
  },

  resizeRow: (rowId, height, applyToAll) => {
    get().commitChange('structure', '调整行高', draft => {
      const clamped = Math.max(40, Math.min(800, height));
      draft.table.rows.forEach(r => {
        if (applyToAll && !r.isHeader) {
          r.height = clamped;
        } else if (r.id === rowId) {
          r.height = clamped;
        }
      });
    });
  },

  insertColumn: (index, type) => {
    get().commitChange('structure', '插入列', draft => {
      const newCol: Column = {
        id: uuidv4(),
        width: type === 'paint' ? 260 : 280,
        type,
        title: type === 'paint' ? '画面' : '备注'
      };
      draft.table.columns.splice(index, 0, newCol);
      draft.table.rows.forEach(row => {
        draft.table.cells[`${row.id}-${newCol.id}`] = {
          id: uuidv4(),
          rowId: row.id,
          colId: newCol.id,
          type: row.isHeader ? 'text' : type,
          backgroundColor: row.isHeader ? '#f1f5f9' : undefined,
          content: row.isHeader
            ? { html: `<strong>${newCol.title}</strong>`, plainText: newCol.title! }
            : type === 'paint'
            ? { thumbnail: '', fullImage: '', canvasWidth: 800, canvasHeight: 450, aspectRatio: '16:9' }
            : { html: '', plainText: '' }
        };
      });
      draft.table.mergedCells = [];
    });
  },

  deleteColumn: (colId) => {
    get().commitChange('structure', '删除列', draft => {
      if (draft.table.columns.length <= 1) return;
      const deletedCellIds = new Set<string>();
      draft.table.rows.forEach(r => {
        const c = draft.table.cells[`${r.id}-${colId}`];
        if (c) deletedCellIds.add(c.id);
        delete draft.table.cells[`${r.id}-${colId}`];
      });
      draft.table.columns = draft.table.columns.filter(c => c.id !== colId);
      draft.table.mergedCells = [];
      draft.canvas.connections = draft.canvas.connections.filter(
        conn => !deletedCellIds.has(conn.fromCellId) && !deletedCellIds.has(conn.toCellId)
      );
    });
  },

  reorderColumns: (fromIndex, toIndex) => {
    get().commitChange('structure', '拖拽重排列', draft => {
      draft.table.mergedCells = [];
      const [moved] = draft.table.columns.splice(fromIndex, 1);
      draft.table.columns.splice(toIndex, 0, moved);
    });
  },

  resizeColumn: (colId, width) => {
    get().commitChange('structure', '调整列宽', draft => {
      const col = draft.table.columns.find(c => c.id === colId);
      if (col) col.width = Math.max(100, Math.min(900, width));
    });
  },

  updateCellContent: (rowId, colId, content) => {
    get().commitChange('content', '修改单元格内容', draft => {
      const cell = draft.table.cells[`${rowId}-${colId}`];
      if (cell) {
        cell.content = content;
      }
    });
  },

  updateCellBackground: (rowId, colId, color) => {
    get().commitChange('content', '修改单元格背景', draft => {
      const cell = draft.table.cells[`${rowId}-${colId}`];
      if (cell) cell.backgroundColor = color;
    });
  },

  mergeSelectedCells: () => {
    const { selectedTableCells, currentProject } = get();
    if (!currentProject || selectedTableCells.length < 2) return;
    const { rows, columns } = currentProject.data.table;

    let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
    selectedTableCells.forEach(key => {
      const [rId, cId] = key.split('-');
      const rIdx = rows.findIndex(r => r.id === rId);
      const cIdx = columns.findIndex(c => c.id === cId);
      if (rIdx > 0 && cIdx >= 0) { // 不允许合并标题行
        minR = Math.min(minR, rIdx);
        maxR = Math.max(maxR, rIdx);
        minC = Math.min(minC, cIdx);
        maxC = Math.max(maxC, cIdx);
      }
    });

    if (minR > maxR || minC > maxC) return;

    get().commitChange('structure', '合并单元格', draft => {
      const mergeId = uuidv4();
      draft.table.mergedCells.push({
        id: mergeId,
        startRow: minR,
        endRow: maxR,
        startCol: minC,
        endCol: maxC
      });
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (r === minR && c === minC) continue;
          const cell = draft.table.cells[`${rows[r].id}-${columns[c].id}`];
          if (cell) cell.mergedFrom = mergeId;
        }
      }
    });
    set({ selectedTableCells: [] });
  },

  selectTableCell: (key, multi) => {
    const { selectedTableCells } = get();
    if (!multi) {
      set({ selectedTableCells: [key], selectedFreeCellIds: [], selectedConnectionId: null });
    } else {
      set({
        selectedTableCells: selectedTableCells.includes(key)
          ? selectedTableCells.filter(k => k !== key)
          : [...selectedTableCells, key]
      });
    }
  },

  setTableSearchQuery: (q) => set({ tableSearchQuery: q }),

  activateFormatPainter: (locked, bg) =>
    set({ formatPainter: { active: true, locked, styleHtmlTemplate: '', backgroundColor: bg } }),

  deactivateFormatPainter: () =>
    set({ formatPainter: { active: false, locked: false, styleHtmlTemplate: '' } }),

  detachCellToCanvas: (rowId, colId, x, y) => {
    get().commitChange('structure', '拖出单元格到画布', draft => {
      const cell = draft.table.cells[`${rowId}-${colId}`];
      const col = draft.table.columns.find(c => c.id === colId);
      const row = draft.table.rows.find(r => r.id === rowId);
      if (!cell || !col || !row || row.isHeader) return;

      const freeCell: FreeCell = {
        id: cell.id, // 保留ID以便连线自动保持！
        sourceCellId: cell.id,
        x,
        y,
        width: col.width,
        height: row.height,
        content: JSON.parse(JSON.stringify(cell.content)),
        type: cell.type,
        backgroundColor: cell.backgroundColor || '#ffffff',
        attachedTo: 'none'
      };
      draft.canvas.freeCells.push(freeCell);

      // 原表格单元格重置为空
      draft.table.cells[`${rowId}-${colId}`] = {
        id: uuidv4(),
        rowId,
        colId,
        type: col.type,
        content:
          col.type === 'paint'
            ? { thumbnail: '', fullImage: '', canvasWidth: 800, canvasHeight: 450, aspectRatio: '16:9' }
            : { html: '', plainText: '' }
      };
    });
  },

  attachFreeCellToTable: (freeCellId, target) => {
    get().commitChange('structure', '吸附自由单元格回表格', draft => {
      const fcIdx = draft.canvas.freeCells.findIndex(f => f.id === freeCellId);
      if (fcIdx === -1) return;
      const fc = draft.canvas.freeCells[fcIdx];

      if (target.kind === 'cell') {
        const destCell = draft.table.cells[`${target.rowId}-${target.colId}`];
        if (!destCell) return;
        const hasContent =
          destCell.type === 'text'
            ? Boolean((destCell.content as TextContent).plainText.trim())
            : Boolean((destCell.content as PaintContent).thumbnail);

        if (hasContent && !window.confirm('目标单元格已有内容，是否覆盖？')) {
          return;
        }
        destCell.id = fc.id;
        destCell.type = fc.type;
        destCell.content = fc.content;
        destCell.backgroundColor = fc.backgroundColor;
        draft.canvas.freeCells.splice(fcIdx, 1);
      } else {
        // 挂在表格边缘（鮣鱼吸附）
        fc.attachedTo = target.edge;
        fc.attachedRowId = target.rowId;
        fc.attachedColId = target.colId;
      }
    });
  },

  moveFreeCells: (ids, dx, dy) => {
    const { currentProject } = get();
    if (!currentProject) return;
    const snap = currentProject.data.canvas.gridSnap;
    const step = 20;

    set({
      currentProject: {
        ...currentProject,
        data: {
          ...currentProject.data,
          canvas: {
            ...currentProject.data.canvas,
            freeCells: currentProject.data.canvas.freeCells.map(fc => {
              if (!ids.includes(fc.id)) return fc;
              const rawX = fc.x + dx;
              const rawY = fc.y + dy;
              return {
                ...fc,
                attachedTo: 'none', // 主动拖动脱离边缘吸附
                x: snap ? Math.round(rawX / step) * step : rawX,
                y: snap ? Math.round(rawY / step) * step : rawY
              };
            })
          }
        }
      }
    });
  },

  resizeFreeCell: (id, width, height) => {
    get().commitChange('structure', '调整自由单元格大小', draft => {
      const fc = draft.canvas.freeCells.find(f => f.id === id);
      if (fc) {
        fc.width = Math.max(120, width);
        fc.height = Math.max(80, height);
      }
    });
  },

  updateFreeCellContent: (id, content) => {
    get().commitChange('content', '更新自由单元格内容', draft => {
      const fc = draft.canvas.freeCells.find(f => f.id === id);
      if (fc) fc.content = content;
    });
  },

  updateFreeCellsBackground: (ids, color) => {
    get().commitChange('content', '批量修改背景色', draft => {
      draft.canvas.freeCells.forEach(fc => {
        if (ids.includes(fc.id)) fc.backgroundColor = color;
      });
    });
  },

  deleteFreeCells: (ids) => {
    get().commitChange('structure', '删除自由单元格', draft => {
      const idSet = new Set(ids);
      draft.canvas.freeCells = draft.canvas.freeCells.filter(fc => !idSet.has(fc.id));
      draft.canvas.connections = draft.canvas.connections.filter(
        c => !idSet.has(c.fromCellId) && !idSet.has(c.toCellId)
      );
    });
    set({ selectedFreeCellIds: [] });
  },

  stackFreeCells: (sourceId, targetId) => {
    if (sourceId === targetId) return;
    get().commitChange('structure', '堆叠自由单元格', draft => {
      const source = draft.canvas.freeCells.find(f => f.id === sourceId);
      const target = draft.canvas.freeCells.find(f => f.id === targetId);
      if (!source || !target) return;

      const groupId = target.stackGroup || uuidv4();
      target.stackGroup = groupId;
      target.isExpanded = false;
      source.stackGroup = groupId;
      source.isExpanded = false;
      source.x = target.x;
      source.y = target.y;
    });
  },

  toggleStackExpand: (stackGroup) => {
    get().commitChange('structure', '展开/收起堆叠', draft => {
      const groupItems = draft.canvas.freeCells.filter(f => f.stackGroup === stackGroup);
      if (groupItems.length === 0) return;
      const nextExpanded = !groupItems[0].isExpanded;
      const baseX = groupItems[0].x;
      const baseY = groupItems[0].y;

      groupItems.forEach((item, idx) => {
        item.isExpanded = nextExpanded;
        if (nextExpanded) {
          item.x = baseX + idx * (item.width + 16);
          item.y = baseY;
        } else {
          item.x = baseX;
          item.y = baseY;
        }
      });
    });
  },

  extractFromStack: (freeCellId) => {
    get().commitChange('structure', '从堆叠中抽出', draft => {
      const fc = draft.canvas.freeCells.find(f => f.id === freeCellId);
      if (fc) {
        fc.stackGroup = undefined;
        fc.isExpanded = undefined;
        fc.y += 30;
      }
    });
  },

  setSelectedFreeCells: (ids) =>
    set({ selectedFreeCellIds: ids, selectedTableCells: [], selectedConnectionId: null }),

  addConnection: (fromCellId, fromAnchor, toCellId, toAnchor) => {
    if (fromCellId === toCellId) return;
    get().commitChange('structure', '创建连线', draft => {
      draft.canvas.connections.push({
        id: uuidv4(),
        fromCellId,
        toCellId,
        fromAnchor,
        toAnchor,
        style: 'curve',
        color: '#6366f1',
        width: 2
      });
    });
  },

  batchConnectFreeCells: (toCellId, toAnchor) => {
    const { selectedFreeCellIds } = get();
    if (selectedFreeCellIds.length === 0) return;
    get().commitChange('structure', '批量连线', draft => {
      selectedFreeCellIds.forEach(fromId => {
        if (fromId !== toCellId) {
          draft.canvas.connections.push({
            id: uuidv4(),
            fromCellId: fromId,
            toCellId,
            fromAnchor: 'middle-right',
            toAnchor,
            style: 'curve',
            color: '#6366f1',
            width: 2
          });
        }
      });
    });
  },

  updateConnection: (id, patch) => {
    get().commitChange('structure', '修改连线样式', draft => {
      const conn = draft.canvas.connections.find(c => c.id === id);
      if (conn) Object.assign(conn, patch);
    });
  },

  deleteConnection: (id) => {
    get().commitChange('structure', '删除连线', draft => {
      draft.canvas.connections = draft.canvas.connections.filter(c => c.id !== id);
    });
    set({ selectedConnectionId: null });
  },

  setSelectedConnection: (id) =>
    set({ selectedConnectionId: id, selectedTableCells: [], selectedFreeCellIds: [] }),

  setViewingPaintCell: (item) => set({ viewingPaintCell: item }),
  setEditingPaintCell: (item) => set({ editingPaintCell: item })
}));