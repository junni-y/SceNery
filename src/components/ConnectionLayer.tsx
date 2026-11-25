import React from 'react';
import { Trash2 } from 'lucide-react';
import { Connection, TableState, FreeCell } from '../types';
import { getCellRectById, getAnchorPoint, generateConnectionPath } from '../utils/geometry';
import { useEditorStore } from '../store/useEditorStore';

interface Props {
  connections: Connection[];
  table: TableState;
  freeCells: FreeCell[];
  draftLine: { x1: number; y1: number; x2: number; y2: number } | null;
}

export const ConnectionLayer: React.FC<Props> = ({
  connections,
  table,
  freeCells,
  draftLine
}) => {
  const {
    selectedConnectionId,
    setSelectedConnection,
    updateConnection,
    deleteConnection
  } = useEditorStore();

  const selectedConn = connections.find(c => c.id === selectedConnectionId);

  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-30">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
          </marker>
        </defs>

        {connections.map(conn => {
          const r1 = getCellRectById(conn.fromCellId, table, freeCells);
          const r2 = getCellRectById(conn.toCellId, table, freeCells);
          if (!r1 || !r2) return null;

          const p1 = getAnchorPoint(r1, conn.fromAnchor);
          const p2 = getAnchorPoint(r2, conn.toAnchor);
          const d = generateConnectionPath(p1, p2, conn.style);
          const isSelected = conn.id === selectedConnectionId;

          return (
            <g
              key={conn.id}
              onClick={e => {
                e.stopPropagation();
                setSelectedConnection(conn.id);
              }}
              className="pointer-events-auto cursor-pointer"
            >
              {/* 透明加粗点击热区 */}
              <path d={d} stroke="transparent" strokeWidth={14} fill="none" />
              <path
                d={d}
                stroke={isSelected ? '#ef4444' : conn.color}
                strokeWidth={isSelected ? conn.width + 2 : conn.width}
                fill="none"
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        {draftLine && (
          <line
            x1={draftLine.x1}
            y1={draftLine.y1}
            x2={draftLine.x2}
            y2={draftLine.y2}
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="6 4"
            markerEnd="url(#arrowhead)"
          />
        )}
      </svg>

      {/* 选中连线时的样式编辑栏 */}
      {selectedConn && (
        <div
          onMouseDown={e => e.stopPropagation()}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 shadow-xl px-4 py-2 rounded-full flex items-center gap-3 text-xs"
        >
          <span className="font-medium text-slate-600">连线样式：</span>
          {(['straight', 'polyline', 'curve'] as const).map(st => (
            <button
              key={st}
              onClick={() => updateConnection(selectedConn.id, { style: st })}
              className={`px-2 py-1 rounded ${
                selectedConn.style === st ? 'bg-indigo-600 text-white' : 'bg-slate-100'
              }`}
            >
              {st === 'straight' ? '直线' : st === 'polyline' ? '折线' : '曲线'}
            </button>
          ))}
          <input
            type="color"
            value={selectedConn.color}
            onChange={e => updateConnection(selectedConn.id, { color: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer"
          />
          <select
            value={selectedConn.width}
            onChange={e => updateConnection(selectedConn.id, { width: Number(e.target.value) })}
            className="border rounded px-1.5 py-1"
          >
            <option value={2}>细线</option>
            <option value={4}>中等</option>
            <option value={6}>粗线</option>
          </select>
          <button
            onClick={() => deleteConnection(selectedConn.id)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-full"
            title="删除连线"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </>
  );
};