import React, { useRef, useState } from 'react';
import { ImagePlus, GripVertical } from 'lucide-react';
import { Cell, PaintContent, TextContent, AnchorPosition } from '../types';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectListStore } from '../store/useProjectListStore';
import { AnchorOverlay } from './AnchorOverlay';

interface Props {
  cell: Cell;
  isHeader: boolean;
  width: number;
  height: number;
  onStartConnect: (cellId: string, anchor: AnchorPosition, e: React.MouseEvent) => void;
  onEndConnect: (cellId: string, anchor: AnchorPosition) => void;
  onStartDetachDrag: (cell: Cell, e: React.MouseEvent) => void;
}

export const CellItem: React.FC<Props> = ({
  cell,
  isHeader,
  width,
  height,
  onStartConnect,
  onEndConnect,
  onStartDetachDrag
}) => {
  const {
    selectedTableCells,
    selectTableCell,
    updateCellContent,
    updateCellBackground,
    tableSearchQuery,
    formatPainter,
    deactivateFormatPainter,
    setViewingPaintCell,
    setEditingPaintCell
  } = useEditorStore();

  const { settings } = useProjectListStore();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);

  const cellKey = `${cell.rowId}-${cell.colId}`;
  const isSelected = selectedTableCells.includes(cellKey);

  const handleCellClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectTableCell(cellKey, e.ctrlKey || e.metaKey);

    if (formatPainter.active) {
      if (formatPainter.backgroundColor) {
        updateCellBackground(cell.rowId, cell.colId, formatPainter.backgroundColor);
      }
      if (!formatPainter.locked) {
        deactivateFormatPainter();
      }
    }
  };

  // 文本单元格逻辑
  const renderTextCell = () => {
    const content = cell.content as TextContent;
    const hasSearchMatch =
      tableSearchQuery.trim().length > 0 &&
      content.plainText.toLowerCase().includes(tableSearchQuery.toLowerCase());

    const handleBlur = () => {
      setIsEditingText(false);
      if (!editorRef.current) return;
      const html = editorRef.current.innerHTML;
      const plainText = editorRef.current.innerText;
      if (html !== content.html) {
        updateCellContent(cell.rowId, cell.colId, { html, plainText });
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      // 默认 Ctrl+Enter 确认完成并退出编辑，Enter 正常换行
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        editorRef.current?.blur();
      }
      e.stopPropagation();
    };

    return (
      <div
        onDoubleClick={() => setIsEditingText(true)}
        className={`w-full h-full p-2.5 overflow-auto text-sm leading-relaxed outline-none ${
          hasSearchMatch ? 'bg-amber-100 ring-2 ring-amber-400' : ''
        }`}
      >
        {isEditingText ? (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            autoFocus
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            dangerouslySetInnerHTML={{ __html: content.html }}
            className="w-full h-full outline-none min-h-[24px]"
          />
        ) : (
          <div
            dangerouslySetInnerHTML={{
              __html:
                content.html ||
                `<span class="text-slate-300 select-none">${
                  isHeader ? '标题' : '双击输入文字...'
                }</span>`
            }}
            className="w-full h-full break-words"
          />
        )}
      </div>
    );
  };

  // 绘画单元格逻辑
  const renderPaintCell = () => {
    const content = cell.content as PaintContent;

    const handleOpenPaint = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (content.fullImage) {
        setViewingPaintCell({ id: cell.id, isFree: false, content });
      } else {
        setEditingPaintCell({ id: cell.id, isFree: false, content });
      }
    };

    return (
      <div
        onClick={handleOpenPaint}
        className="w-full h-full p-2 flex items-center justify-center cursor-pointer group/paint relative"
      >
        {content.thumbnail ? (
          <img
            src={content.thumbnail}
            alt="thumb"
            className="max-w-full max-h-full object-contain rounded shadow-sm pointer-events-none"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400 group-hover/paint:text-indigo-600 transition-colors">
            <ImagePlus size={22} />
            <span className="text-xs">点击绘制分镜</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={handleCellClick}
      style={{
        width,
        height,
        backgroundColor: cell.backgroundColor || (isHeader ? '#f1f5f9' : '#ffffff')
      }}
      className={`group relative border-r border-b border-slate-300 select-none transition-shadow ${
        isSelected ? 'ring-2 ring-inset ring-indigo-600 z-10' : ''
      }`}
    >
      {/* 非标题行允许拖出到无限画布 */}
      {!isHeader && (
        <div
          onMouseDown={e => {
            e.stopPropagation();
            onStartDetachDrag(cell, e);
          }}
          className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 p-1 rounded bg-slate-100/90 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 cursor-grab z-20"
          title="拖拽此单元格到画布自由区域"
        >
          <GripVertical size={13} />
        </div>
      )}

      {cell.type === 'paint' && !isHeader ? renderPaintCell() : renderTextCell()}

      {/* 8锚点连线 */}
      {!isHeader && (
        <AnchorOverlay
          cellId={cell.id}
          onStartConnect={onStartConnect}
          onEndConnect={onEndConnect}
        />
      )}
    </div>
  );
};