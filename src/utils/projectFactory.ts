import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectData, Row, Column, Cell } from '../types';

export function createInitialProjectData(): ProjectData {
  const col1Id = uuidv4();
  const col2Id = uuidv4();
  const col3Id = uuidv4();

  const columns: Column[] = [
    { id: col1Id, width: 260, type: 'paint', title: '画面 / 镜头' },
    { id: col2Id, width: 320, type: 'text', title: '画面描述 / 动作' },
    { id: col3Id, width: 280, type: 'text', title: '台词 / 音效 / 备注' }
  ];

  const rows: Row[] = [
    { id: uuidv4(), height: 44, isHeader: true, backgroundColor: '#f1f5f9' },
    { id: uuidv4(), height: 160, isHeader: false },
    { id: uuidv4(), height: 160, isHeader: false },
    { id: uuidv4(), height: 160, isHeader: false }
  ];

  const cells: Record<string, Cell> = {};

  rows.forEach((row, rIdx) => {
    columns.forEach((col, cIdx) => {
      const key = `${row.id}-${col.id}`;
      if (row.isHeader) {
        cells[key] = {
          id: uuidv4(),
          rowId: row.id,
          colId: col.id,
          type: 'text',
          content: {
            html: `<strong>${col.title || `列 ${cIdx + 1}`}</strong>`,
            plainText: col.title || `列 ${cIdx + 1}`
          },
          backgroundColor: '#f1f5f9'
        };
      } else {
        cells[key] = {
          id: uuidv4(),
          rowId: row.id,
          colId: col.id,
          type: col.type,
          content:
            col.type === 'paint'
              ? {
                  thumbnail: '',
                  fullImage: '',
                  canvasWidth: 800,
                  canvasHeight: 450,
                  aspectRatio: '16:9'
                }
              : {
                  html: '',
                  plainText: ''
                }
        };
      }
    });
  });

  return {
    version: 1,
    table: {
      x: 120,
      y: 100,
      rows,
      columns,
      cells,
      mergedCells: []
    },
    canvas: {
      zoom: 1,
      panX: 0,
      panY: 0,
      showGrid: true,
      gridSnap: true,
      freeCells: [],
      connections: []
    }
  };
}

export function createNewProject(name = '未命名分镜项目'): Project {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
    data: createInitialProjectData()
  };
}