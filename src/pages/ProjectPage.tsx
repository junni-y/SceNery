import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Settings,
  Search
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectListStore } from '../store/useProjectListStore';
import { FormatToolbar } from '../components/FormatToolbar';
import { TableCanvas } from '../components/TableCanvas';
import { SettingsPanel } from '../components/SettingsPanel';
import {
  exportProjectSB,
  exportStoryboardCards,
  exportBirdseyeView
} from '../utils/exportUtils';

interface Props {
  projectId: string;
  onBack: () => void;
}

export const ProjectPage: React.FC<Props> = ({ projectId, onBack }) => {
  const {
    currentProject,
    openProject,
    updateProjectName,
    undo,
    redo,
    undoStack,
    redoStack,
    tableSearchQuery,
    setTableSearchQuery,
    selectedFreeCellIds,
    deleteFreeCells,
    selectedConnectionId,
    deleteConnection,
    saveProject
  } = useEditorStore();

  const { loadProjects } = useProjectListStore();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    openProject(projectId);
  }, [projectId, openProject]);

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isEditing =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.getAttribute('contenteditable') === 'true';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isEditing) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !isEditing) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveProject();
      } else if (e.key === 'Delete' && !isEditing) {
        if (selectedFreeCellIds.length > 0) {
          deleteFreeCells(selectedFreeCellIds);
        } else if (selectedConnectionId) {
          deleteConnection(selectedConnectionId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, saveProject, selectedFreeCellIds, selectedConnectionId, deleteFreeCells, deleteConnection]);

  if (!currentProject) {
    return <div className="h-screen flex items-center justify-center text-slate-500">加载项目中...</div>;
  }

  const handleGoBack = async () => {
    await saveProject();
    await loadProjects();
    onBack();
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50">
      {/* 顶部导航栏 */}
      <header className="h-12 bg-white border-b px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={handleGoBack}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} /> 返回主页
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <input
            value={currentProject.name}
            onChange={e => updateProjectName(e.target.value)}
            className="font-semibold text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 px-2 py-1 rounded outline-none text-sm"
          />
        </div>

        {/* 中部搜索框 */}
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={tableSearchQuery}
            onChange={e => setTableSearchQuery(e.target.value)}
            placeholder="搜索表格内分镜台词/描述..."
            className="w-full pl-8 pr-3 py-1 text-xs bg-slate-100 rounded-full focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-700"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 size={17} />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-700"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 size={17} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
            >
              <Download size={14} /> 导出
            </button>

            {showExportMenu && (
              <div
                onMouseLeave={() => setShowExportMenu(false)}
                className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 shadow-xl rounded-xl py-1.5 text-xs text-slate-700 z-50"
              >
                <button
                  onClick={() => {
                    exportProjectSB(currentProject);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100"
                >
                  导出工程文件 (.sb)
                </button>
                <button
                  onClick={() => {
                    exportStoryboardCards(currentProject, 'top-bottom');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100"
                >
                  分镜卡 PNG 序列（上图下文）
                </button>
                <button
                  onClick={() => {
                    exportStoryboardCards(currentProject, 'left-right');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100"
                >
                  分镜卡 PNG 序列（左图右文）
                </button>
                <button
                  onClick={() => {
                    exportBirdseyeView(currentProject);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 border-t"
                >
                  全局画布鸟瞰图 (.png)
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
            title="快捷键与设置"
          >
            <Settings size={17} />
          </button>
        </div>
      </header>

      <FormatToolbar />
      <TableCanvas />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
};