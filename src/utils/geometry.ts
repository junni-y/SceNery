import { AnchorPosition, TableState, FreeCell } from '../types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 计算表格中某个单元格在无限画布中的绝对坐标矩形
export function getTableCellRect(table: TableState, rowId: string, colId: string): Rect | null {
  const rowIndex = table.rows.findIndex(r => r.id === rowId);
  const colIndex = table.columns.findIndex(c => c.id === colId);
  if (rowIndex === -1 || colIndex === -1) return null;

  // 加上行拖拽柄宽度(36px)与列头高度(32px)
  const ROW_HANDLE_WIDTH = 36;
  const COL_HEADER_HEIGHT = 32;

  let offsetX = table.x + ROW_HANDLE_WIDTH;
  for (let i = 0; i < colIndex; i++) {
    offsetX += table.columns[i].width;
  }

  let offsetY = table.y + COL_HEADER_HEIGHT;
  for (let i = 0; i < rowIndex; i++) {
    offsetY += table.rows[i].height;
  }

  let width = table.columns[colIndex].width;
  let height = table.rows[rowIndex].height;

  // 检查合并单元格
  const merged = table.mergedCells.find(
    m => rowIndex >= m.startRow && rowIndex <= m.endRow && colIndex >= m.startCol && colIndex <= m.endCol
  );
  if (merged) {
    width = 0;
    for (let c = merged.startCol; c <= merged.endCol; c++) width += table.columns[c].width;
    height = 0;
    for (let r = merged.startRow; r <= merged.endRow; r++) height += table.rows[r].height;
  }

  return { x: offsetX, y: offsetY, width, height };
}

export function getCellRectById(
  cellId: string,
  table: TableState,
  freeCells: FreeCell[]
): Rect | null {
  // 先找自由单元格
  const fc = freeCells.find(f => f.id === cellId);
  if (fc) {
    return { x: fc.x, y: fc.y, width: fc.width, height: fc.height };
  }
  // 再找表格单元格
  const cell = Object.values(table.cells).find(c => c.id === cellId);
  if (cell) {
    return getTableCellRect(table, cell.rowId, cell.colId);
  }
  return null;
}

export function getAnchorPoint(rect: Rect, anchor: AnchorPosition): { x: number; y: number } {
  switch (anchor) {
    case 'top-left': return { x: rect.x, y: rect.y };
    case 'top-center': return { x: rect.x + rect.width / 2, y: rect.y };
    case 'top-right': return { x: rect.x + rect.width, y: rect.y };
    case 'middle-left': return { x: rect.x, y: rect.y + rect.height / 2 };
    case 'middle-right': return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case 'bottom-left': return { x: rect.x, y: rect.y + rect.height };
    case 'bottom-center': return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 'bottom-right': return { x: rect.x + rect.width, y: rect.y + rect.height };
  }
}

export function generateConnectionPath(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  style: 'straight' | 'polyline' | 'curve'
): string {
  if (style === 'straight') {
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  }
  if (style === 'polyline') {
    const midX = (p1.x + p2.x) / 2;
    return `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`;
  }
  // 贝塞尔曲线
  const dx = Math.abs(p2.x - p1.x) * 0.5;
  return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
}