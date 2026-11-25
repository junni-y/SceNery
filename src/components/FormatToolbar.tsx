import React, { useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Paintbrush,
  Type
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

export const FormatToolbar: React.FC = () => {
  const {
    formatPainter,
    activateFormatPainter,
    deactivateFormatPainter,
    selectedTableCells,
    updateCellBackground
  } = useEditorStore();

  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) {
        setFloatingPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0) {
        setFloatingPos({
          x: rect.left + rect.width / 2,
          y: Math.max(60, rect.top - 48)
        });
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  };

  const handlePainterClick = () => {
    if (formatPainter.active) {
      deactivateFormatPainter();
    } else {
      activateFormatPainter(false, '#fef08a');
    }
  };

  const handlePainterDoubleClick = () => {
    activateFormatPainter(true, '#fef08a');
  };

  const applyCellBg = (color: string) => {
    selectedTableCells.forEach(key => {
      const [rId, cId] = key.split('-');
      updateCellBackground(rId, cId, color);
    });
  };

  const renderControls = () => (
    <div className="flex items-center gap-1">
      <button
        onMouseDown={e => {
          e.preventDefault();
          execCommand('bold');
        }}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700"
        title="加粗"
      >
        <Bold size={15} />
      </button>
      <button
        onMouseDown={e => {
          e.preventDefault();
          execCommand('italic');
        }}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700"
        title="斜体"
      >
        <Italic size={15} />
      </button>

      <div className="h-4 w-px bg-slate-300 mx-1" />

      <button
        onMouseDown={e => {
          e.preventDefault();
          execCommand('justifyLeft');
        }}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700"
        title="左对齐"
      >
        <AlignLeft size={15} />
      </button>
      <button
        onMouseDown={e => {
          e.preventDefault();
          execCommand('justifyCenter');
        }}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700"
        title="居中对齐"
      >
        <AlignCenter size={15} />
      </button>
      <button
        onMouseDown={e => {
          e.preventDefault();
          execCommand('justifyRight');
        }}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700"
        title="右对齐"
      >
        <AlignRight size={15} />
      </button>

      <div className="h-4 w-px bg-slate-300 mx-1" />

      {/* 字号 */}
      <select
        onChange={e => execCommand('fontSize', e.target.value)}
        defaultValue="3"
        className="text-xs border rounded px-1.5 py-1 bg-white text-slate-700"
        title="字号"
      >
        <option value="2">小号</option>
        <option value="3">正常</option>
        <option value="5">大号</option>
        <option value="6">标题</option>
      </select>

      {/* 文字颜色 */}
      <label className="p-1.5 rounded hover:bg-slate-200 cursor-pointer flex items-center" title="文字颜色">
        <Type size={15} className="text-red-600" />
        <input
          type="color"
          className="w-0 h-0 opacity-0"
          onChange={e => execCommand('foreColor', e.target.value)}
        />
      </label>

      {/* 文字高亮 */}
      <button
        onMouseDown={e => {
          e.preventDefault();
          execCommand('hiliteColor', '#fef08a');
        }}
        className="p-1.5 rounded hover:bg-slate-200 text-amber-600"
        title="高亮背景"
      >
        <Highlighter size={15} />
      </button>

      <div className="h-4 w-px bg-slate-300 mx-1" />

      {/* 格式刷（单击单次，双击锁定） */}
      <button
        onClick={handlePainterClick}
        onDoubleClick={handlePainterDoubleClick}
        className={`p-1.5 rounded flex items-center gap-1 text-xs ${
          formatPainter.active
            ? 'bg-indigo-600 text-white'
            : 'hover:bg-slate-200 text-slate-700'
        }`}
        title="格式刷（单击单次使用，双击锁定连续刷）"
      >
        <Paintbrush size={15} />
        {formatPainter.locked && <span>锁定</span>}
      </button>

      {/* 单元格背景色快捷块 */}
      <div className="h-4 w-px bg-slate-300 mx-1" />
      <div className="flex items-center gap-1">
        {['#ffffff', '#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3'].map(bg => (
          <button
            key={bg}
            onClick={() => applyCellBg(bg)}
            className="w-4 h-4 rounded border border-slate-300"
            style={{ backgroundColor: bg }}
            title="设置选中单元格背景色"
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* 顶部固定格式栏 */}
      <div className="h-10 bg-white border-b px-4 flex items-center justify-between text-sm z-20 shrink-0">
        {renderControls()}
        <span className="text-xs text-slate-400">
          提示：Enter 换行 · Ctrl+Enter 确认完成 · 拖拽单元格边缘可拖出至无限画布
        </span>
      </div>

      {/* 选中文字时的浮动格式栏 */}
      {floatingPos && (
        <div
          style={{ left: floatingPos.x, top: floatingPos.y }}
          className="fixed -translate-x-1/2 z-50 bg-white shadow-xl border border-slate-200 rounded-lg px-2 py-1"
        >
          {renderControls()}
        </div>
      )}
    </>
  );
};