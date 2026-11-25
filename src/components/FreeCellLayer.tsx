import React, { useState } from 'react';
import { Layers, Trash2, Link2, ExternalLink, ImagePlus } from 'lucide-react';
import { FreeCell, PaintContent, TextContent, AnchorPosition } from '../types';
import { useEditorStore } from '../store/useEditorStore';
import { AnchorOverlay } from './AnchorOverlay';

interface Props {
  freeCells: FreeCell[];
  zoom: number;
  onStartConnect: (cellId: string, anchor: AnchorPosition, e: React.MouseEvent) => void;
  onEndConnect: (cellId: string, anchor: AnchorPosition) => void;
  onDropFreeCellCheck: (freeCell: FreeCell) => void;
}

export const FreeCellLayer: React.FC<Props> = ({
  freeCells,
  zoom,
  onStartConnect,
  onEndConnect,
  onDropFreeCellCheck
}) => {
  const {
    selectedFreeCellIds,
    setSelectedFreeCells,
    moveFreeCells,
    resizeFreeCell,
    updateFreeCellContent,
    updateFreeCellsBackground,
    deleteFreeCells,
    stackFreeCells,
    toggleStackExpand,
    extractFromStack,
    setViewingPaintCell,
    setEditingPaintCell
  } = useEditorStore();

  const [editingId, setEditingId] = useState<string | null>(null);

  // 统计堆叠组数量
  const stackCounts: Record<string, number> = {};
  freeCells.forEach(fc => {
    if (fc.stackGroup) {
      stackCounts[fc.stackGroup] = (stackCounts[fc.stackGroup] || 0) + 1;
    }
  });

  const handleDragStart = (fc: FreeCell, e: React.MouseEvent) => {
    e.stopPropagation();
    const isAlreadySelected = selectedFreeCellIds.includes(fc.id);
    const activeIds = isAlreadySelected ? selectedFreeCellIds : [fc.id];
    if (!isAlreadySelected) {
      setSelectedFreeCells([fc.id]);
    }

    let lastX = e.clientX;
    let lastY = e.clientY;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - lastX) / zoom;
      const dy = (ev.clientY - lastY) / zoom;
      lastX = ev.clientX;
      lastY = ev.clientY;
      moveFreeCells(activeIds, dx, dy);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      // 检测是否拖拽重叠到另一个自由单元格 -> 触发堆叠
      const currentCells = useEditorStore.getState().currentProject?.data.canvas.freeCells || [];
      const movedCell = currentCells.find(c => c.id === fc.id);
      if (movedCell && activeIds.length === 1) {
        const overlapTarget = currentCells.find(
          other =>
            other.id !== movedCell.id &&
            Math.abs(other.x - movedCell.x) < 50 &&
            Math.abs(other.y - movedCell.y) < 50
        );
        if (overlapTarget) {
          stackFreeCells(movedCell.id, overlapTarget.id);
          return;
        }
        // 检测是否拖回表格吸附
        onDropFreeCellCheck(movedCell);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleResizeStart = (fc: FreeCell, e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = fc.width;
    const origH = fc.height;

    const onMove = (ev: MouseEvent) => {
      resizeFreeCell(fc.id, origW + (ev.clientX - startX) / zoom, origH + (ev.clientY - startY) / zoom);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <>
      {freeCells.map(fc => {
        const isSelected = selectedFreeCellIds.includes(fc.id);
        const stackSize = fc.stackGroup ? stackCounts[fc.stackGroup] : 0;

        return (
          <div
            key={fc.id}
            onMouseDown={e => handleDragStart(fc, e)}
            onClick={e => {
              e.stopPropagation();
              if (e.ctrlKey || e.metaKey) {
                setSelectedFreeCells(
                  isSelected
                    ? selectedFreeCellIds.filter(id => id !== fc.id)
                    : [...selectedFreeCellIds, fc.id]
                );
              } else {
                setSelectedFreeCells([fc.id]);
              }
            }}
            style={{
              transform: `translate(${fc.x}px, ${fc.y}px)`,
              width: fc.width,
              height: fc.height,
              backgroundColor: fc.backgroundColor || '#ffffff'
            }}
            className={`group absolute top-0 left-0 rounded-lg shadow-md border-2 transition-shadow cursor-grab ${
              isSelected
                ? 'border-indigo-600 ring-4 ring-indigo-500/20 z-30'
                : fc.attachedTo !== 'none'
                ? 'border-emerald-500 z-20'
                : 'border-slate-300 z-20'
            }`}
          >
            {/* 鮣鱼吸附标识 */}
            {fc.attachedTo !== 'none' && (
              <div className="absolute -top-2.5 left-2 px-1.5 py-0.2 bg-emerald-600 text-white text-[10px] rounded">
                已吸附表格
              </div>
            )}

            {/* 堆叠数量角标 */}
            {stackSize > 1 && (
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation();
                  toggleStackExpand(fc.stackGroup!);
                }}
                className="absolute -top-3 -right-3 px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full shadow flex items-center gap-1 hover:bg-amber-600 z-30"
                title="点击展开/收起堆叠"
              >
                <Layers size={12} /> {stackSize}
              </button>
            )}

            {/* 展开后可单独抽出按钮 */}
            {fc.stackGroup && fc.isExpanded && (
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation();
                  extractFromStack(fc.id);
                }}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded flex items-center gap-1 whitespace-nowrap"
              >
                <ExternalLink size={10} /> 抽出此卡
              </button>
            )}

            {/* 内容区 */}
            {fc.type === 'paint' ? (
              <div
                onDoubleClick={e => {
                  e.stopPropagation();
                  const pc = fc.content as PaintContent;
                  if (pc.fullImage) {
                    setViewingPaintCell({ id: fc.id, isFree: true, content: pc });
                  } else {
                    setEditingPaintCell({ id: fc.id, isFree: true, content: pc });
                  }
                }}
                className="w-full h-full p-2 flex items-center justify-center overflow-hidden"
              >
                {(fc.content as PaintContent).thumbnail ? (
                  <img
                    src={(fc.content as PaintContent).thumbnail}
                    alt="free-paint"
                    className="max-w-full max-h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center text-xs">
                    <ImagePlus size={20} />
                    <span>双击绘画</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                onDoubleClick={e => {
                  e.stopPropagation();
                  setEditingId(fc.id);
                }}
                className="w-full h-full p-3 text-sm overflow-auto"
              >
                {editingId === fc.id ? (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    autoFocus
                    onMouseDown={e => e.stopPropagation()}
                    onBlur={e => {
                      setEditingId(null);
                      updateFreeCellContent(fc.id, {
                        html: e.currentTarget.innerHTML,
                        plainText: e.currentTarget.innerText
                      });
                    }}
                    dangerouslySetInnerHTML={{ __html: (fc.content as TextContent).html }}
                    className="w-full h-full outline-none"
                  />
                ) : (
                  <div
                    dangerouslySetInnerHTML={{
                      __html:
                        (fc.content as TextContent).html ||
                        '<span class="text-slate-400">双击编辑自由便签...</span>'
                    }}
                  />
                )}
              </div>
            )}

            {/* 右下角调整大小手柄 */}
            <div
              onMouseDown={e => handleResizeStart(fc, e)}
              className="opacity-0 group-hover:opacity-100 absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize bg-indigo-500/40 rounded-tl"
            />

            {/* 8锚点 */}
            <AnchorOverlay
              cellId={fc.id}
              onStartConnect={onStartConnect}
              onEndConnect={onEndConnect}
            />
          </div>
        );
      })}

      {/* 自由单元格多选浮动操作栏 */}
      {selectedFreeCellIds.length > 1 && (
        <div
          onMouseDown={e => e.stopPropagation()}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 text-xs"
        >
          <span className="font-medium">已选中 {selectedFreeCellIds.length} 个自由卡片</span>
          <div className="flex items-center gap-1">
            {['#ffffff', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8'].map(c => (
              <button
                key={c}
                onClick={() => updateFreeCellsBackground(selectedFreeCellIds, c)}
                className="w-4 h-4 rounded-full border border-white/40"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={() => {
              const targetId = prompt('输入要批量连线的目标单元格ID，或直接点击目标锚点');
              if (targetId) useEditorStore.getState().batchConnectFreeCells(targetId, 'middle-left');
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 rounded-full hover:bg-indigo-500"
          >
            <Link2 size={12} /> 批量连线
          </button>
          <button
            onClick={() => deleteFreeCells(selectedFreeCellIds)}
            className="flex items-center gap-1 px-2.5 py-1 bg-red-600 rounded-full hover:bg-red-500"
          >
            <Trash2 size={12} /> 删除
          </button>
        </div>
      )}
    </>
  );
};