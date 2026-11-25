import { Project, PaintContent, TextContent } from '../types';

// 1. 导出 .sb 文件
export function exportProjectSB(project: Project) {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name}.sb`;
  a.click();
  URL.revokeObjectURL(url);
}

// 2. 导出分镜卡 PNG 序列
export async function exportStoryboardCards(
  project: Project,
  layout: 'top-bottom' | 'left-right'
) {
  const { table } = project.data;
  const paintCol = table.columns.find(c => c.type === 'paint');
  const textCols = table.columns.filter(c => c.type === 'text');
  const dataRows = table.rows.filter(r => !r.isHeader);

  if (!paintCol) {
    alert('当前表格没有绘画列，无法生成分镜卡！');
    return;
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const paintCell = table.cells[`${row.id}-${paintCol.id}`];
    const paintContent = paintCell?.content as PaintContent;
    if (!paintContent?.fullImage) continue;

    const img = await loadImage(paintContent.fullImage);
    const texts = textCols
      .map(tc => (table.cells[`${row.id}-${tc.id}`]?.content as TextContent)?.plainText || '')
      .filter(Boolean)
      .join('\n\n');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const imgW = img.width;
    const imgH = img.height;

    if (layout === 'top-bottom') {
      canvas.width = imgW;
      canvas.height = imgH + 220;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, imgW, imgH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`镜头 #${i + 1}`, 24, imgH + 40);

      ctx.fillStyle = '#334155';
      ctx.font = '20px sans-serif';
      wrapText(ctx, texts || '（无描述）', 24, imgH + 80, imgW - 48, 28);
    } else {
      canvas.width = imgW + 420;
      canvas.height = imgH;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, imgW, imgH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`镜头 #${i + 1}`, imgW + 24, 44);

      ctx.fillStyle = '#334155';
      ctx.font = '20px sans-serif';
      wrapText(ctx, texts || '（无描述）', imgW + 24, 88, 372, 28);
    }

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${project.name}_Shot_${String(i + 1).padStart(2, '0')}.png`;
    a.click();
  }
}

// 3. 全局鸟瞰图导出
export async function exportBirdseyeView(project: Project) {
  const { table, canvas: canvasState } = project.data;
  const totalTableW = table.columns.reduce((acc, c) => acc + c.width, 36);
  const totalTableH = table.rows.reduce((acc, r) => acc + r.height, 32);

  let minX = table.x;
  let minY = table.y;
  let maxX = table.x + totalTableW;
  let maxY = table.y + totalTableH;

  canvasState.freeCells.forEach(fc => {
    minX = Math.min(minX, fc.x);
    minY = Math.min(minY, fc.y);
    maxX = Math.max(maxX, fc.x + fc.width);
    maxY = Math.max(maxY, fc.y + fc.height);
  });

  const padding = 80;
  const width = Math.max(1200, maxX - minX + padding * 2);
  const height = Math.max(800, maxY - minY + padding * 2);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  // 绘制表格网格与内容
  let curY = table.y + offsetY + 32;
  for (const row of table.rows) {
    let curX = table.x + offsetX + 36;
    for (const col of table.columns) {
      const cell = table.cells[`${row.id}-${col.id}`];
      ctx.fillStyle = cell?.backgroundColor || row.backgroundColor || '#ffffff';
      ctx.fillRect(curX, curY, col.width, row.height);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(curX, curY, col.width, row.height);

      if (cell) {
        if (cell.type === 'paint') {
          const pc = cell.content as PaintContent;
          if (pc.thumbnail) {
            const img = await loadImage(pc.thumbnail);
            const scale = Math.min((col.width - 12) / img.width, (row.height - 12) / img.height);
            const dw = img.width * scale;
            const dh = img.height * scale;
            ctx.drawImage(img, curX + (col.width - dw) / 2, curY + (row.height - dh) / 2, dw, dh);
          }
        } else {
          const tc = cell.content as TextContent;
          ctx.fillStyle = '#1e293b';
          ctx.font = row.isHeader ? 'bold 14px sans-serif' : '14px sans-serif';
          wrapText(ctx, tc.plainText, curX + 10, curY + 24, col.width - 20, 20);
        }
      }
      curX += col.width;
    }
    curY += row.height;
  }

  // 绘制自由单元格
  for (const fc of canvasState.freeCells) {
    const fx = fc.x + offsetX;
    const fy = fc.y + offsetY;
    ctx.fillStyle = fc.backgroundColor || '#ffffff';
    ctx.fillRect(fx, fy, fc.width, fc.height);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, fy, fc.width, fc.height);

    if (fc.type === 'paint') {
      const pc = fc.content as PaintContent;
      if (pc.thumbnail) {
        const img = await loadImage(pc.thumbnail);
        ctx.drawImage(img, fx + 4, fy + 4, fc.width - 8, fc.height - 8);
      }
    } else {
      const tc = fc.content as TextContent;
      ctx.fillStyle = '#1e293b';
      ctx.font = '14px sans-serif';
      wrapText(ctx, tc.plainText, fx + 10, fy + 24, fc.width - 20, 20);
    }
  }

  const a = document.createElement('a');
  a.href = exportCanvas.toDataURL('image/png');
  a.download = `${project.name}_鸟瞰图.png`;
  a.click();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = text.split('\n');
  let currentY = y;
  for (const paragraph of lines) {
    let line = '';
    for (let i = 0; i < paragraph.length; i++) {
      const testLine = line + paragraph[i];
      if (ctx.measureText(testLine).width > maxWidth && i > 0) {
        ctx.fillText(line, x, currentY);
        line = paragraph[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
}