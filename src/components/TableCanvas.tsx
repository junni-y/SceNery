import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Grid, Magnet, PlusSquare } from 'lucide-react';
import { Cell, AnchorPosition, FreeCell } from '../types';
import { useEditorStore } from '../store/useEditorStore';
import { getCellRectById, getAnchorPoint } from '../utils/geometry';
import { GridTable } from './GridTable';
import { FreeCellLayer } from './FreeCellLayer';
import { ConnectionLayer } from './ConnectionLayer';
import { MiniMap } from './MiniMap';
import { PaintViewerAndModal } from './PaintModal';
import { v4 as uuidv4 } from 'uuid';

export const TableCanvas: React.FC = () => {
  const {
    currentProject,
    setZoom,
    setPan,
    toggleGrid,
    toggleGridSnap,
    detachCellToCanvas,
    attachFreeCellToTable,
    addConnection,
    selectedFreeCellIds,
    batchConnectFreeCells,
    setSelectedFreeCells
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  // 连线拖拽草稿
  const [connectingFrom, setConnectingFrom] = useState<{
    cellId: string;
    anchor: AnchorPosition;
    x: number;
    y: number;
  } | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);

  // 框选矩形
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.getAttribute('contenteditable') !== 'true') {
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setViewportSize(current =>
        current.width === width && current.height === height ? current : { width, height }
      );
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize();
    return () => observer.disconnect();
  }, []);

  if (!currentProject) return null;
  const { table, canvas } = currentProject.data;

  const tableWidth = table.columns.reduce((total, column) => total + column.width, 36);
  const tableHeight = table.rows.reduce((total, row) => total + row.height, 32);
  const viewportWorldWidth = viewportSize.width / canvas.zoom;
  const viewportWorldHeight = viewportSize.height / canvas.zoom;
  const viewportLeft = -canvas.panX / canvas.zoom;
  const viewportTop = -canvas.panY / canvas.zoom;

  const contentBounds = canvas.freeCells.reduce(
    (bounds, cell) => ({
      minX: Math.min(bounds.minX, cell.x),
      maxX: Math.max(bounds.maxX, cell.x + cell.width),
      minY: Math.min(bounds.minY, cell.y),
      maxY: Math.max(bounds.maxY, cell.y + cell.height)
    }),
    {
      minX: table.x,
      maxX: table.x + tableWidth,
      minY: table.y,
      maxY: table.y + tableHeight
    }
  );

  const minViewX = Math.min(contentBounds.minX - viewportWorldWidth / 2, viewportLeft);
  const maxViewX = Math.max(
    contentBounds.maxX + viewportWorldWidth / 2,
    viewportLeft + viewportWorldWidth
  );
  const minViewY = Math.min(contentBounds.minY - viewportWorldHeight / 2, viewportTop);
  const maxViewY = Math.max(
    contentBounds.maxY + viewportWorldHeight / 2,
    viewportTop + viewportWorldHeight
  );

  // 屏幕坐标转画布世界坐标
  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - canvas.panX) / canvas.zoom,
      y: (clientY - rect.top - canvas.panY) / canvas.zoom
    };
  };

  // 滚轮缩放与触控板双指平移
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom(canvas.zoom * factor);
    } else {
      setPan(canvas.panX - e.deltaX, canvas.panY - e.deltaY);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // 空格+左键 或 鼠标中键 -> 平移画布
    if (spacePressed || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const origPanX = canvas.panX;
      const origPanY = canvas.panY;

      const onMove = (ev: MouseEvent) => {
        setPan(origPanX + (ev.clientX - startX), origPanY + (ev.clientY - startY));
      };
      const onUp = () => {
        setIsPanning(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    // 空白处左键拖拽 -> 框选自由单元格
    if (e.button === 0) {
      const startWorld = screenToWorld(e.clientX, e.clientY);
      setMarquee({ x1: startWorld.x, y1: startWorld.y, x2: startWorld.x, y2: startWorld.y });

      const onMove = (ev: MouseEvent) => {
        const curWorld = screenToWorld(ev.clientX, ev.clientY);
        setMarquee({ x1: startWorld.x, y1: startWorld.y, x2: curWorld.x, y2: curWorld.y });
      };
      const onUp = (ev: MouseEvent) => {
        const endWorld = screenToWorld(ev.clientX, ev.clientY);
        const minX = Math.min(startWorld.x, endWorld.x);
        const maxX = Math.max(startWorld.x, endWorld.x);
        const minY = Math.min(startWorld.y, endWorld.y);
        const maxY = Math.max(startWorld.y, endWorld.y);

        if (maxX - minX > 10 || maxY - minY > 10) {
          const hitIds = canvas.freeCells
            .filter(
              fc =>
                fc.x + fc.width >= minX &&
                fc.x <= maxX &&
                fc.y + fc.height >= minY &&
                fc.y <= maxY
            )
            .map(fc => fc.id);
          setSelectedFreeCells(hitIds);
        } else {
          setSelectedFreeCells([]);
        }
        setMarquee(null);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  };

  // 从表格拖出单元格到画布
  const handleStartDetachDrag = (cell: Cell, e: React.MouseEvent) => {
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mouseup', onUp);
      const world = screenToWorld(ev.clientX, ev.clientY);
      detachCellToCanvas(cell.rowId, cell.colId, world.x - 100, world.y - 50);
    };
    window.addEventListener('mouseup', onUp);
  };

  // 检测自由单元格是否拖回表格（填入单元格 / 鮣鱼吸附表格边缘）
  const handleDropFreeCellCheck = (fc: FreeCell) => {
    const totalW = table.columns.reduce((acc, c) => acc + c.width, 36);
    const totalH = table.rows.reduce((acc, r) => acc + r.height, 32);

    const cx = fc.x + fc.width / 2;
    const cy = fc.y + fc.height / 2;

    // 1. 落在表格内部 -> 匹配具体行列单元格
    if (
      cx >= table.x + 36 &&
      cx <= table.x + totalW &&
      cy >= table.y + 32 &&
      cy <= table.y + totalH
    ) {
      let accX = table.x + 36;
      const targetCol = table.columns.find(col => {
        const hit = cx >= accX && cx <= accX + col.width;
        accX += col.width;
        return hit;
      });
      let accY = table.y + 32;
      const targetRow = table.rows.find(row => {
        const hit = cy >= accY && cy <= accY + row.height;
        accY += row.height;
        return hit;
      });
      if (targetRow && targetCol && !targetRow.isHeader) {
        attachFreeCellToTable(fc.id, {
          kind: 'cell',
          rowId: targetRow.id,
          colId: targetCol.id
        });
        return;
      }
    }

    // 2. 靠近表格四条边缘 35px 内 -> 鮣鱼吸附
    const nearLeft = Math.abs(fc.x + fc.width - table.x) < 35;
    const nearRight = Math.abs(fc.x - (table.x + totalW)) < 35;
    const nearTop = Math.abs(fc.y + fc.height - table.y) < 35;
    const nearBottom = Math.abs(fc.y - (table.y + totalH)) < 35;

    if (nearLeft || nearRight || nearTop || nearBottom) {
      const edge = nearLeft ? 'left' : nearRight ? 'right' : nearTop ? 'top' : 'bottom';
      attachFreeCellToTable(fc.id, { kind: 'edge', edge });
    }
  };

  // 开始连线
  const handleStartConnect = (cellId: string, anchor: AnchorPosition, e: React.MouseEvent) => {
    const rect = getCellRectById(cellId, table, canvas.freeCells);
    if (!rect) return;
    const pt = getAnchorPoint(rect, anchor);
    setConnectingFrom({ cellId, anchor, x: pt.x, y: pt.y });
    setMouseCanvasPos(pt);

    const onMove = (ev: MouseEvent) => {
      setMouseCanvasPos(screenToWorld(ev.clientX, ev.clientY));
    };
    const onUp = () => {
      setConnectingFrom(null);
      setMouseCanvasPos(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleEndConnect = (toCellId: string, toAnchor: AnchorPosition) => {
    if (!connectingFrom) return;
    if (selectedFreeCellIds.length > 1 && selectedFreeCellIds.includes(connectingFrom.cellId)) {
      batchConnectFreeCells(toCellId, toAnchor);
    } else {
      addConnection(connectingFrom.cellId, connectingFrom.anchor, toCellId, toAnchor);
    }
    setConnectingFrom(null);
    setMouseCanvasPos(null);
  };

  // 新建自由便签卡
  const addFreeNote = () => {
    useEditorStore.getState().commitChange('structure', '新建自由便签', draft => {
      draft.canvas.freeCells.push({
        id: uuidv4(),
        x: (-draft.canvas.panX + 200) / draft.canvas.zoom,
        y: (-draft.canvas.panY + 150) / draft.canvas.zoom,
        width: 220,
        height: 140,
        type: 'text',
        content: { html: '', plainText: '' },
        backgroundColor: '#fef9c3',
        attachedTo: 'none'
      });
    });
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      style={{
        backgroundImage: canvas.showGrid
          ? 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)'
          : 'none',
        backgroundSize: `${20 * canvas.zoom}px ${20 * canvas.zoom}px`,
        backgroundPosition: `${canvas.panX}px ${canvas.panY}px`
      }}
      className={`relative flex-1 overflow-hidden bg-slate-50 ${
        spacePressed || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      {/* 无限画布世界坐标系层 */}
      <div
        style={{
          transform: `translate(${canvas.panX}px, ${canvas.panY}px) scale(${canvas.zoom})`,
          transformOrigin: '0 0'
        }}
        className="absolute top-0 left-0 w-0 h-0"
      >
        <GridTable
          table={table}
          zoom={canvas.zoom}
          onStartConnect={handleStartConnect}
          onEndConnect={handleEndConnect}
          onStartDetachDrag={handleStartDetachDrag}
        />

        <FreeCellLayer
          freeCells={canvas.freeCells}
          zoom={canvas.zoom}
          onStartConnect={handleStartConnect}
          onEndConnect={handleEndConnect}
          onDropFreeCellCheck={handleDropFreeCellCheck}
        />

        <ConnectionLayer
          connections={canvas.connections}
          table={table}
          freeCells={canvas.freeCells}
          draftLine={
            connectingFrom && mouseCanvasPos
              ? {
                  x1: connectingFrom.x,
                  y1: connectingFrom.y,
                  x2: mouseCanvasPos.x,
                  y2: mouseCanvasPos.y
                }
              : null
          }
        />

        {/* 框选区域 */}
        {marquee && (
          <div
            style={{
              left: Math.min(marquee.x1, marquee.x2),
              top: Math.min(marquee.y1, marquee.y2),
              width: Math.abs(marquee.x2 - marquee.x1),
              height: Math.abs(marquee.y2 - marquee.y1)
            }}
            className="absolute border border-indigo-500 bg-indigo-500/10 pointer-events-none z-40"
          />
        )}
      </div>

      {viewportSize.width > 0 && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            left: 'clamp(12px, calc(50% - 100px), 300px)',
            right: '240px',
            bottom: '72px'
          }}
          className="absolute z-30 flex h-7 items-center rounded-full border border-slate-200 bg-white/90 px-3 shadow-sm"
          title="拖动以水平平移画布"
        >
          <input
            type="range"
            min={minViewX}
            max={Math.max(minViewX, maxViewX - viewportWorldWidth)}
            step="any"
            value={viewportLeft}
            onChange={e => setPan(-Number(e.currentTarget.value) * canvas.zoom, canvas.panY)}
            aria-label="水平平移画布"
            className="canvas-pan-range w-full"
          />
        </div>
      )}

      {viewportSize.height > 200 && (
        <div
          onMouseDown={e => e.stopPropagation()}
          className="absolute bottom-[176px] right-2 top-3 z-30 flex w-7 items-center justify-center rounded-full border border-slate-200 bg-white/90 py-3 shadow-sm"
          title="拖动以垂直平移画布"
        >
          <input
            type="range"
            min={minViewY}
            max={Math.max(minViewY, maxViewY - viewportWorldHeight)}
            step="any"
            value={viewportTop}
            onChange={e => setPan(canvas.panX, -Number(e.currentTarget.value) * canvas.zoom)}
            aria-label="垂直平移画布"
            className="canvas-pan-range canvas-pan-range-vertical h-full"
            style={{ writingMode: 'vertical-lr' }}
          />
        </div>
      )}

      {/* 左下角画布控制浮岛 */}
      <div
        onMouseDown={e => e.stopPropagation()}
        className="fixed bottom-4 left-4 z-40 bg-white border border-slate-200 shadow-lg rounded-xl px-2 py-1.5 flex items-center gap-1.5 text-xs text-slate-700"
      >
        <button
          onClick={() => setZoom(canvas.zoom - 0.15)}
          className="p-1.5 hover:bg-slate-100 rounded-lg"
          title="缩小"
        >
          <ZoomOut size={15} />
        </button>
        <span className="w-11 text-center font-mono">{Math.round(canvas.zoom * 100)}%</span>
        <button
          onClick={() => setZoom(canvas.zoom + 0.15)}
          className="p-1.5 hover:bg-slate-100 rounded-lg"
          title="放大"
        >
          <ZoomIn size={15} />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <button
          onClick={toggleGrid}
          className={`p-1.5 rounded-lg ${canvas.showGrid ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100'}`}
          title="显示/隐藏点阵网格"
        >
          <Grid size={15} />
        </button>
        <button
          onClick={toggleGridSnap}
          className={`p-1.5 rounded-lg ${canvas.gridSnap ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100'}`}
          title="网格吸附开关"
        >
          <Magnet size={15} />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <button
          onClick={addFreeNote}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-medium"
        >
          <PlusSquare size={14} /> 自由便签
        </button>
      </div>

      <MiniMap
        table={table}
        freeCells={canvas.freeCells}
        zoom={canvas.zoom}
        panX={canvas.panX}
        panY={canvas.panY}
      />

      <PaintViewerAndModal />
    </div>
  );
};