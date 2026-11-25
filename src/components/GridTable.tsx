import React, { useState } from 'react';
import { GripHorizontal, GripVertical, Plus, Move } from 'lucide-react';
import { TableState, Cell, AnchorPosition } from '../types';
import { useEditorStore } from '../store/useEditorStore';
import { CellItem } from './CellItem';

interface Props {
  table: TableState;
  zoom: number;
  onStartConnect: (cellId: string, anchor: AnchorPosition, e: React.MouseEvent) => void;
  onEndConnect: (cellId: string, anchor: AnchorPosition) => void;
  onStartDetachDrag: (cell: Cell, e: React.MouseEvent) => void;
}

export const GridTable: React.FC<Props> = ({
  table,
  zoom,
  onStartConnect,
  onEndConnect,
  onStartDetachDrag
}) => {
  const {
    moveTablePosition,
    insertRows,
    deleteRows,
    duplicateRow,
    reorderRows,
    resizeRow,
    insertColumn,
    deleteColumn,
    reorderColumns,
    resizeColumn,
    mergeSelectedCells,
    selectedTableCells
  } = useEditorStore();

  // 行拖拽重排状态
  const [dragRowIdx, setDragRowIdx] = useState<number | null>(null);
  const [dropRowTarget, setDropRowTarget] = useState<{ index: number; mode: 'insert' | 'swap' } | null>(null);

  // 列拖拽重排状态
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dropColIdx, setDropColIdx] = useState<number | null>(null);

  // 行高调整弹窗选项（仅此行 / 统一）
  const [rowResizePrompt, setRowResizePrompt] = useState<{ rowId: string; newHeight: number } | null>(null);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetType: 'row' | 'col' | 'cell';
    index: number;
    id: string;
  } | null>(null);

  // 整体移动表格
  const handleMoveTableMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = table.x;
    const origY = table.y;

    const onMove = (ev: MouseEvent) => {
      moveTablePosition(origX + (ev.clientX - startX) / zoom, origY + (ev.clientY - startY) / zoom);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 拖拽调整列宽
  const handleColResizeMouseDown = (colId: string, origWidth: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const onMove = (ev: MouseEvent) => {
      resizeColumn(colId, origWidth + (ev.clientX - startX) / zoom);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 拖拽调整行高
  const handleRowResizeMouseDown = (rowId: string, origHeight: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const startY = e.clientY;
    let latestH = origHeight;
    const onMove = (ev: MouseEvent) => {
      latestH = Math.max(40, origHeight + (ev.clientY - startY) / zoom);
      resizeRow(rowId, latestH, false);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setRowResizePrompt({ rowId, newHeight: Math.round(latestH) });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      style={{ transform: `translate(${table.x}px, ${table.y}px)` }}
      onClick={() => setContextMenu(null)}
      className="absolute top-0 left-0 bg-white shadow-xl border border-slate-300 rounded-sm select-none"
    >
      {/* 顶部列头栏 */}
      <div className="flex bg-slate-100 border-b border-slate-300 h-8">
        {/* 左上角整体拖拽把手 */}
        <div
          onMouseDown={handleMoveTableMouseDown}
          className="w-9 h-8 border-r border-slate-300 flex items-center justify-center cursor-move hover:bg-indigo-100 text-slate-500"
          title="按住拖动整个表格"
        >
          <Move size={14} />
        </div>

        {table.columns.map((col, cIdx) => (
          <div
            key={col.id}
            style={{ width: col.width }}
            draggable
            onDragStart={() => setDragColIdx(cIdx)}
            onDragOver={e => {
              e.preventDefault();
              setDropColIdx(cIdx);
            }}
            onDrop={() => {
              if (dragColIdx !== null && dragColIdx !== cIdx) {
                reorderColumns(dragColIdx, cIdx);
              }
              setDragColIdx(null);
              setDropColIdx(null);
            }}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, targetType: 'col', index: cIdx, id: col.id });
            }}
            className={`relative h-8 border-r border-slate-300 flex items-center justify-center text-xs text-slate-500 cursor-grab hover:bg-slate-200 ${
              dropColIdx === cIdx ? 'border-l-4 border-l-indigo-600' : ''
            }`}
          >
            <GripHorizontal size={14} className="mr-1 text-slate-400" />
            <span>{col.type === 'paint' ? '绘画列' : '文字列'}</span>

            {/* 列宽调整分隔线 */}
            <div
              onMouseDown={e => handleColResizeMouseDown(col.id, col.width, e)}
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500"
            />
          </div>
        ))}

        {/* 快捷添加列 */}
        <button
          onClick={() => insertColumn(table.columns.length, 'text')}
          className="px-2 h-8 text-slate-500 hover:bg-slate-200 flex items-center"
          title="新增文字列"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 行列表 */}
      {table.rows.map((row, rIdx) => {
        const isDropTarget = dropRowTarget?.index === rIdx;
        return (
          <div
            key={row.id}
            className={`flex relative ${
              isDropTarget && dropRowTarget.mode === 'swap' ? 'ring-2 ring-indigo-500 z-20' : ''
            } ${
              isDropTarget && dropRowTarget.mode === 'insert'
                ? 'border-t-4 border-t-indigo-600'
                : ''
            }`}
          >
            {/* 行首拖拽与序号区 */}
            <div
              draggable={!row.isHeader}
              onMouseDown={e => e.stopPropagation()}
              onDragStart={() => setDragRowIdx(rIdx)}
              onDragOver={e => {
                e.preventDefault();
                if (row.isHeader) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                // 靠近上边缘25%触发插入，中心区域触发交换
                const mode = relY < rect.height * 0.25 ? 'insert' : 'swap';
                setDropRowTarget({ index: rIdx, mode });
              }}
              onDrop={() => {
                if (dragRowIdx !== null && dropRowTarget && dragRowIdx !== dropRowTarget.index) {
                  reorderRows(dragRowIdx, dropRowTarget.index, dropRowTarget.mode);
                }
                setDragRowIdx(null);
                setDropRowTarget(null);
              }}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, targetType: 'row', index: rIdx, id: row.id });
              }}
              style={{ height: row.height }}
              className={`relative w-9 border-r border-b border-slate-300 flex flex-col items-center justify-center text-xs text-slate-500 ${
                row.isHeader ? 'bg-slate-200 font-bold' : 'bg-slate-50 cursor-grab hover:bg-slate-200'
              }`}
            >
              {!row.isHeader && <GripVertical size={13} className="text-slate-400" />}
              <span>{row.isHeader ? 'H' : rIdx}</span>

              {/* 行高调整分隔线 */}
              <div
                onMouseDown={e => handleRowResizeMouseDown(row.id, row.height, e)}
                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-indigo-500"
              />
            </div>

            {/* 单元格渲染（处理合并逻辑） */}
            {table.columns.map((col, cIdx) => {
              const cell = table.cells[`${row.id}-${col.id}`];
              if (!cell || cell.mergedFrom) return null;

              let spanWidth = col.width;
              let spanHeight = row.height;

              const merged = table.mergedCells.find(
                m => m.startRow === rIdx && m.startCol === cIdx
              );
              if (merged) {
                spanWidth = 0;
                for (let c = merged.startCol; c <= merged.endCol; c++) {
                  spanWidth += table.columns[c].width;
                }
                spanHeight = 0;
                for (let r = merged.startRow; r <= merged.endRow; r++) {
                  spanHeight += table.rows[r].height;
                }
              }

              return (
                <div
                  key={cell.id}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      targetType: 'cell',
                      index: rIdx,
                      id: `${row.id}-${col.id}`
                    });
                  }}
                >
                  <CellItem
                    cell={cell}
                    isHeader={row.isHeader}
                    width={spanWidth}
                    height={spanHeight}
                    onStartConnect={onStartConnect}
                    onEndConnect={onEndConnect}
                    onStartDetachDrag={onStartDetachDrag}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* 底部快捷添加行 */}
      <button
        onClick={() => insertRows(table.rows.length, 1)}
        className="w-full py-2 text-xs text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center gap-1 transition-colors"
      >
        <Plus size={14} /> 添加新镜头行
      </button>

      {/* 拖拽行高后弹出的选项浮层 */}
      {rowResizePrompt && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-3 text-xs">
          <span>行高已设为 {rowResizePrompt.newHeight}px：</span>
          <button
            onClick={() => setRowResizePrompt(null)}
            className="px-2.5 py-1 bg-slate-700 rounded-full hover:bg-slate-600"
          >
            仅此行
          </button>
          <button
            onClick={() => {
              resizeRow(rowResizePrompt.rowId, rowResizePrompt.newHeight, true);
              setRowResizePrompt(null);
            }}
            className="px-2.5 py-1 bg-indigo-600 rounded-full hover:bg-indigo-500"
          >
            统一所有行
          </button>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-lg py-1.5 w-44 text-sm text-slate-700"
        >
          {contextMenu.targetType === 'row' && (
            <>
              <button
                onClick={() => {
                  const num = Number(prompt('向上插入几行？', '1') || 0);
                  if (num > 0) insertRows(Math.max(1, contextMenu.index), num);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
              >
                向上插入行...
              </button>
              <button
                onClick={() => {
                  const num = Number(prompt('向下插入几行？', '1') || 0);
                  if (num > 0) insertRows(contextMenu.index + 1, num);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
              >
                向下插入行...
              </button>
              {contextMenu.index > 0 && (
                <>
                  <button
                    onClick={() => {
                      duplicateRow(contextMenu.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
                  >
                    复制此行
                  </button>
                  <button
                    onClick={() => {
                      const val = Number(prompt('输入精确行高(px)：', '160') || 0);
                      if (val >= 40) resizeRow(contextMenu.id, val, false);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
                  >
                    设置精确行高...
                  </button>
                  <button
                    onClick={() => {
                      deleteRows([contextMenu.id]);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
                  >
                    删除此行
                  </button>
                </>
              )}
            </>
          )}

          {contextMenu.targetType === 'col' && (
            <>
              <button
                onClick={() => {
                  insertColumn(contextMenu.index + 1, 'paint');
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
              >
                右侧插入绘画列
              </button>
              <button
                onClick={() => {
                  insertColumn(contextMenu.index + 1, 'text');
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
              >
                右侧插入文字列
              </button>
              <button
                onClick={() => {
                  const val = Number(prompt('输入精确列宽(px)：', '280') || 0);
                  if (val >= 100) resizeColumn(contextMenu.id, val);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
              >
                设置精确列宽...
              </button>
              <button
                onClick={() => {
                  deleteColumn(contextMenu.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
              >
                删除此列
              </button>
            </>
          )}

          {contextMenu.targetType === 'cell' && (
            <button
              disabled={selectedTableCells.length < 2}
              onClick={() => {
                mergeSelectedCells();
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
            >
              合并选中单元格 ({selectedTableCells.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
};