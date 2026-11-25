// ============ 项目管理 ============
export interface Project {
  id: string;
  name: string;
  coverImage?: string;
  createdAt: number;
  updatedAt: number;
  data: ProjectData;
}

export interface ProjectData {
  table: TableState;
  canvas: CanvasState;
  version: number;
}

// ============ 表格 ============
export interface TableState {
  x: number; // 表格在无限画布中的位置X
  y: number; // 表格在无限画布中的位置Y
  rows: Row[];
  columns: Column[];
  cells: Record<string, Cell>; // key: `${rowId}-${colId}`
  mergedCells: MergedCell[];
}

export interface Row {
  id: string;
  height: number; // 像素
  isHeader: boolean; // 标题行
  backgroundColor?: string;
}

export interface Column {
  id: string;
  width: number; // 像素
  type: 'text' | 'paint'; // 列类型
  title?: string;
}

export interface Cell {
  id: string;
  rowId: string;
  colId: string;
  type: 'text' | 'paint';
  content: TextContent | PaintContent;
  backgroundColor?: string;
  mergedFrom?: string; // 合并来源 MergedCell.id
}

export interface TextContent {
  html: string; // 富文本HTML
  plainText: string; // 纯文本（用于搜索）
}

export interface PaintContent {
  thumbnail: string; // base64 缩略图
  fullImage: string; // base64 完整图
  canvasWidth: number;
  canvasHeight: number;
  aspectRatio: '16:9' | '4:3' | '1:1';
}

export interface MergedCell {
  id: string;
  startRow: number; // 索引
  endRow: number;
  startCol: number;
  endCol: number;
}

// ============ 画布 ============
export type AnchorPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface CanvasState {
  zoom: number; // 0.1 - 5
  panX: number;
  panY: number;
  showGrid: boolean;
  gridSnap: boolean;
  freeCells: FreeCell[];
  connections: Connection[];
}

export interface FreeCell {
  id: string;
  sourceCellId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: TextContent | PaintContent;
  type: 'text' | 'paint';
  backgroundColor?: string;
  attachedTo: 'top' | 'bottom' | 'left' | 'right' | 'none';
  attachedRowId?: string;
  attachedColId?: string;
  stackGroup?: string; // 堆叠组ID
  stackIndex?: number; // 堆叠顺序
  isExpanded?: boolean; // 是否已展开
}

export interface Connection {
  id: string;
  fromCellId: string; // 可以是 table cell id 或 freeCell id
  toCellId: string;
  fromAnchor: AnchorPosition;
  toAnchor: AnchorPosition;
  style: 'straight' | 'polyline' | 'curve';
  color: string;
  width: number;
}

// ============ 撤销栈 ============
export interface UndoItem {
  type: 'structure' | 'content';
  action: string;
  before: string; // JSON序列化的ProjectData快照
  after: string;
  timestamp: number;
}

// ============ 快捷键与设置 ============
export interface ShortcutConfig {
  undo: string;
  redo: string;
  save: string;
  delete: string;
  selectAll: string;
  confirmEdit: string; // 默认 Ctrl+Enter
  toggleGrid: string;
}

export interface AppSettings {
  shortcuts: ShortcutConfig;
  defaultAspectRatio: '16:9' | '4:3' | '1:1';
}