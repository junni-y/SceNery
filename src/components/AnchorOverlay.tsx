import React from 'react';
import { AnchorPosition } from '../types';

const ANCHORS: { pos: AnchorPosition; className: string }[] = [
  { pos: 'top-left', className: '-top-1.5 -left-1.5' },
  { pos: 'top-center', className: '-top-1.5 left-1/2 -translate-x-1/2' },
  { pos: 'top-right', className: '-top-1.5 -right-1.5' },
  { pos: 'middle-left', className: 'top-1/2 -left-1.5 -translate-y-1/2' },
  { pos: 'middle-right', className: 'top-1/2 -right-1.5 -translate-y-1/2' },
  { pos: 'bottom-left', className: '-bottom-1.5 -left-1.5' },
  { pos: 'bottom-center', className: '-bottom-1.5 left-1/2 -translate-x-1/2' },
  { pos: 'bottom-right', className: '-bottom-1.5 -right-1.5' }
];

interface Props {
  cellId: string;
  onStartConnect: (cellId: string, anchor: AnchorPosition, e: React.MouseEvent) => void;
  onEndConnect: (cellId: string, anchor: AnchorPosition) => void;
}

export const AnchorOverlay: React.FC<Props> = ({
  cellId,
  onStartConnect,
  onEndConnect
}) => {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      {ANCHORS.map(a => (
        <div
          key={a.pos}
          onMouseDown={e => {
            e.stopPropagation();
            onStartConnect(cellId, a.pos, e);
          }}
          onMouseUp={e => {
            e.stopPropagation();
            onEndConnect(cellId, a.pos);
          }}
          className={`pointer-events-auto absolute w-3 h-3 rounded-full bg-white border-2 border-indigo-600 hover:bg-indigo-600 hover:scale-125 cursor-crosshair z-20 ${a.className}`}
          title="拖拽连线"
        />
      ))}
    </div>
  );
};