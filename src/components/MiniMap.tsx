import React, { useState } from 'react';
import { Map, X } from 'lucide-react';
import { TableState, FreeCell } from '../types';
import { useEditorStore } from '../store/useEditorStore';

interface Props {
  table: TableState;
  freeCells: FreeCell[];
  zoom: number;
  panX: number;
  panY: number;
}

export const MiniMap: React.FC<Props> = ({ table, freeCells, zoom, panX, panY }) => {
  const [visible, setVisible] = useState(true);
  const { setPan } = useEditorStore();

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-40 bg-white border border-slate-200 shadow-lg p-2.5 rounded-lg hover:bg-slate-50 text-slate-700"
        title="打开小地图"
      >
      </button>
    );
  }

  const SCALE = 0.06;
  const OFFSET_X = 60;
  const OFFSET_Y = 60;

  const tableW = table.columns.reduce((acc, c) => acc + c.width, 36);
  const tableH = table.rows.reduce((acc, r) => acc + r.height, 32);

  const handleViewportDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origPanX = panX;
    const origPanY = panY;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / SCALE;
      const dy = (ev.clientY - startY) / SCALE;
      setPan(origPanX - dx * zoom, origPanY - dy * zoom);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      className="fixed bottom-4 right-4 z-40 w-56 h-40 bg-white/95 backdrop-blur border border-slate-300 rounded-xl shadow-xl overflow-hidden select-none"
    >
      <div className="px-2.5 py-1 bg-slate-100 border-b flex items-center justify-between text-[11px] text-slate-500">
        <span>画布导航</span>
        <button onClick={() => setVisible(false)} className="hover:text-slate-800">
          <X size={13} />
        </button>
      </div>

      <div className="relative w-full h-full bg-slate-50">
        {/* 表格缩略块 */}
        <div
          style={{
            left: OFFSET_X + table.x * SCALE,
            top: OFFSET_Y + table.y * SCALE,
            width: Math.max(20, tableW * SCALE),
            height: Math.max(16, tableH * SCALE)
          }}
          className="absolute bg-indigo-200 border border-indigo-500 pointer-events-none"
        />

        {/* 自由单元格缩略块 */}
        {freeCells.map(fc => (
          <div
            key={fc.id}
            style={{
              left: OFFSET_X + fc.x * SCALE,
              top: OFFSET_Y + fc.y * SCALE,
              width: Math.max(6, fc.width * SCALE),
              height: Math.max(6, fc.height * SCALE)
            }}
            className="absolute bg-amber-300 border border-amber-600 pointer-events-none"
          />
        ))}

        {/* 视口框（仅此框可拖拽导航） */}
        <div
          onMouseDown={handleViewportDrag}
          style={{
            left: OFFSET_X + (-panX / zoom) * SCALE,
            top: OFFSET_Y + (-panY / zoom) * SCALE,
            width: Math.max(24, (window.innerWidth / zoom) * SCALE),
            height: Math.max(18, (window.innerHeight / zoom) * SCALE)
          }}
          className="absolute border-2 border-red-500 bg-red-500/10 cursor-move"
          title="拖动视口框移动视野"
        />
      </div>
    </div>
  );
};