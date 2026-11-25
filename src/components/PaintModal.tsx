import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Undo2,
  Redo2,
  Eraser,
  Pencil,
  X,
  Check,
  Edit3,
  Trash2
} from 'lucide-react';
import { PaintContent } from '../types';
import { useEditorStore } from '../store/useEditorStore';

const COLORS = ['#0f172a', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];
const BRUSH_SIZES = [2, 5, 10, 20];
const RATIOS: Record<'16:9' | '4:3' | '1:1', { w: number; h: number }> = {
  '16:9': { w: 800, h: 450 },
  '4:3': { w: 800, h: 600 },
  '1:1': { w: 600, h: 600 }
};

export const PaintViewerAndModal: React.FC = () => {
  const {
    viewingPaintCell,
    editingPaintCell,
    setViewingPaintCell,
    setEditingPaintCell,
    currentProject,
    updateCellContent,
    updateFreeCellContent
  } = useEditorStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  const [color, setColor] = useState('#0f172a');
  const [brushSize, setBrushSize] = useState(5);
  const [ratio, setRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9');
  const [isDrawing, setIsDrawing] = useState(false);

  // 绘画弹窗独立撤销栈（存储 ImageData）
  const [history, setHistory] = useState<string[]>([]);
  const [redoList, setRedoList] = useState<string[]>([]);

  useEffect(() => {
    if (!editingPaintCell) return;
    const initRatio = editingPaintCell.content.aspectRatio || '16:9';
    setRatio(initRatio);
    setHistory([]);
    setRedoList([]);

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (editingPaintCell.content.fullImage) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHistory([canvas.toDataURL()]);
        };
        img.src = editingPaintCell.content.fullImage;
      } else {
        setHistory([canvas.toDataURL()]);
      }
    }, 20);
  }, [editingPaintCell]);

  // 弹窗内独立 Ctrl+Z / Ctrl+Y
  useEffect(() => {
    if (!editingPaintCell) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        handleModalUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        e.stopPropagation();
        handleModalRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  });

  const restoreSnapshot = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  const handleModalUndo = () => {
    if (history.length <= 1) return;
    const current = history[history.length - 1];
    const prev = history[history.length - 2];
    setHistory(history.slice(0, -1));
    setRedoList([...redoList, current]);
    restoreSnapshot(prev);
  };

  const handleModalRedo = () => {
    if (redoList.length === 0) return;
    const next = redoList[redoList.length - 1];
    setRedoList(redoList.slice(0, -1));
    setHistory([...history, next]);
    restoreSnapshot(next);
  };

  const handleRatioChange = (newRatio: '16:9' | '4:3' | '1:1') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prevData = canvas.toDataURL();
    setRatio(newRatio);
    setTimeout(() => {
      const nextCanvas = canvasRef.current;
      if (!nextCanvas) return;
      const ctx = nextCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHistory(h => [...h, nextCanvas.toDataURL()]);
      };
      img.src = prevData;
    }, 10);
  };

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = brushSize;
    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setHistory(prev => [...prev.slice(-29), canvas.toDataURL()]);
      setRedoList([]);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev, canvas.toDataURL()]);
  };

  const handleSavePaint = () => {
    const canvas = canvasRef.current;
    if (!canvas || !editingPaintCell || !currentProject) return;

    const fullImage = canvas.toDataURL('image/png');
    // 生成等比缩略图
    const thumbCanvas = document.createElement('canvas');
    const scale = 320 / canvas.width;
    thumbCanvas.width = 320;
    thumbCanvas.height = Math.round(canvas.height * scale);
    const tCtx = thumbCanvas.getContext('2d')!;
    tCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.85);

    const newContent: PaintContent = {
      thumbnail,
      fullImage,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      aspectRatio: ratio
    };

    if (editingPaintCell.isFree) {
      updateFreeCellContent(editingPaintCell.id, newContent);
    } else {
      const cell = Object.values(currentProject.data.table.cells).find(
        c => c.id === editingPaintCell.id
      );
      if (cell) {
        updateCellContent(cell.rowId, cell.colId, newContent);
      }
    }
    setEditingPaintCell(null);
  };

  // 1. 大图查看器
  if (viewingPaintCell && !editingPaintCell) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-8"
        onClick={() => setViewingPaintCell(null)}
      >
        <div
          className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-50">
            <span className="font-medium text-slate-700">
              分镜预览 ({viewingPaintCell.content.aspectRatio})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const target = viewingPaintCell;
                  setViewingPaintCell(null);
                  setEditingPaintCell(target);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
              >
                <Edit3 size={16} /> 编辑画板
              </button>
              <button
                onClick={() => setViewingPaintCell(null)}
                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="p-6 bg-slate-100 flex items-center justify-center min-h-[400px]">
            {viewingPaintCell.content.fullImage ? (
              <img
                src={viewingPaintCell.content.fullImage}
                alt="Storyboard Frame"
                className="max-h-[70vh] object-contain shadow-md bg-white"
              />
            ) : (
              <div className="text-slate-400">暂无画面内容，点击右上角"编辑画板"开始绘制</div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // 2. 极简绘画弹窗
  if (editingPaintCell) {
    const dim = RATIOS[ratio];
    return createPortal(
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-5xl w-full overflow-hidden">
          {/* 顶部工具栏 */}
          <div className="px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTool('pencil')}
                className={`p-2 rounded-lg ${
                  tool === 'pencil' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="铅笔"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-2 rounded-lg ${
                  tool === 'eraser' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="橡皮擦"
              >
                <Eraser size={18} />
              </button>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              {/* 颜色 */}
              <div className="flex items-center gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      setTool('pencil');
                    }}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color === c && tool === 'pencil' ? 'border-indigo-600 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              {/* 粗细 */}
              <div className="flex items-center gap-1">
                {BRUSH_SIZES.map(sz => (
                  <button
                    key={sz}
                    onClick={() => setBrushSize(sz)}
                    className={`w-7 h-7 rounded flex items-center justify-center ${
                      brushSize === sz ? 'bg-slate-200' : 'hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="rounded-full bg-slate-800 block"
                      style={{ width: Math.min(18, sz + 2), height: Math.min(18, sz + 2) }}
                    />
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              {/* 画布比例 */}
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-medium">
                {(['16:9', '4:3', '1:1'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => handleRatioChange(r)}
                    className={`px-2 py-1 rounded-md ${
                      ratio === r ? 'bg-white shadow text-indigo-600' : 'text-slate-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleModalUndo}
                disabled={history.length <= 1}
                className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-40"
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 size={18} />
              </button>
              <button
                onClick={handleModalRedo}
                disabled={redoList.length === 0}
                className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-40"
                title="重做 (Ctrl+Y)"
              >
                <Redo2 size={18} />
              </button>
              <button
                onClick={clearCanvas}
                className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                title="清空画布"
              >
                <Trash2 size={18} />
              </button>
              <div className="h-5 w-px bg-slate-300 mx-1" />
              <button
                onClick={() => setEditingPaintCell(null)}
                className="px-3 py-1.5 rounded-lg border hover:bg-slate-100 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSavePaint}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
              >
                <Check size={16} /> 完成
              </button>
            </div>
          </div>

          {/* 画布区域 */}
          <div className="p-6 bg-slate-200 flex items-center justify-center overflow-auto min-h-[500px]">
            <canvas
              ref={canvasRef}
              width={dim.w}
              height={dim.h}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              className="bg-white shadow-xl cursor-crosshair touch-none max-w-full max-h-[68vh]"
            />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return null;
};