import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Copy,
  Trash2,
  Upload,
  Film,
  CheckSquare,
  Square
} from 'lucide-react';
import { useProjectListStore } from '../store/useProjectListStore';
import { Project } from '../types';

interface Props {
  onOpenProject: (id: string) => void;
}

export const ProjectHomePage: React.FC<Props> = ({ onOpenProject }) => {
  const {
    projects,
    searchQuery,
    selectedIds,
    loadProjects,
    setSearchQuery,
    toggleSelect,
    selectAll,
    clearSelection,
    createProject,
    deleteProjects,
    duplicateProjects,
    renameProject,
    setProjectCover,
    importProjectSB
  } = useProjectListStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [cardContextMenu, setCardContextMenu] = useState<{
    x: number;
    y: number;
    project: Project;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [coverTargetId, setCoverTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Ctrl+A 全选支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          selectAll();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll]);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    const proj = await createProject();
    onOpenProject(proj.id);
  };

  const handleImportSB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Project;
        if (parsed.data?.table && parsed.data?.canvas) {
          await importProjectSB(parsed);
        } else {
          alert('无效的 .sb 工程文件');
        }
      } catch {
        alert('文件解析失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coverTargetId) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProjectCover(coverTargetId, reader.result as string);
      setCoverTargetId(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div
      onClick={() => {
        clearSelection();
        setCardContextMenu(null);
      }}
      className="min-h-screen bg-slate-50 flex flex-col"
    >
      {/* 顶部栏 */}
      <header className="h-16 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow">
            <Film size={20} />
          </div>
          <h1 className="text-lg font-bold text-slate-800">Storyboard Studio</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
              placeholder="搜索项目名称..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            onClick={e => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium"
          >
            <Upload size={16} /> 导入 .sb
          </button>

          <button
            onClick={e => {
              e.stopPropagation();
              handleCreate();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm"
          >
            <Plus size={18} /> 新建分镜项目
          </button>
        </div>
      </header>

      {/* 项目卡片网格 */}
      <main className="flex-1 p-8 max-w-7xl w-full mx-auto">
        {filteredProjects.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Film size={48} strokeWidth={1.2} />
            <p>暂无分镜项目，点击右上角「新建分镜项目」开始创作</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProjects.map(project => {
              const isSelected = selectedIds.includes(project.id);
              return (
                <div
                  key={project.id}
                  onClick={e => {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) {
                      toggleSelect(project.id, true);
                    } else {
                      onOpenProject(project.id);
                    }
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCardContextMenu({ x: e.clientX, y: e.clientY, project });
                  }}
                  className={`group bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer relative ${
                    isSelected ? 'ring-2 ring-indigo-600 border-indigo-600' : 'border-slate-200'
                  }`}
                >
                  {/* 多选勾选框 */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleSelect(project.id, true);
                    }}
                    className={`absolute top-3 left-3 z-10 p-1 rounded-md bg-white/90 shadow ${
                      isSelected ? 'opacity-100 text-indigo-600' : 'opacity-0 group-hover:opacity-100 text-slate-500'
                    }`}
                  >
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>

                  {/* 封面缩略图 */}
                  <div className="h-40 bg-gradient-to-br from-indigo-50 via-slate-100 to-purple-50 flex items-center justify-center overflow-hidden border-b">
                    {project.coverImage ? (
                      <img
                        src={project.coverImage}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film size={32} className="text-indigo-200" />
                    )}
                  </div>

                  {/* 卡片信息 */}
                  <div className="p-4">
                    {renamingId === project.id ? (
                      <input
                        autoFocus
                        value={renameVal}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setRenameVal(e.target.value)}
                        onBlur={() => {
                          if (renameVal.trim()) renameProject(project.id, renameVal.trim());
                          setRenamingId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (renameVal.trim()) renameProject(project.id, renameVal.trim());
                            setRenamingId(null);
                          }
                        }}
                        className="w-full font-semibold text-slate-800 border rounded px-1.5 py-0.5 text-sm"
                      />
                    ) : (
                      <h3
                        onDoubleClick={e => {
                          e.stopPropagation();
                          setRenamingId(project.id);
                          setRenameVal(project.name);
                        }}
                        className="font-semibold text-slate-800 truncate text-sm"
                      >
                        {project.name}
                      </h3>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">
                      修改于 {new Date(project.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 多选批量操作栏 */}
      {selectedIds.length > 0 && (
        <div
          onClick={e => e.stopPropagation()}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-4 text-sm"
        >
          <span>已选择 {selectedIds.length} 个项目</span>
          <button
            onClick={() => duplicateProjects(selectedIds)}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 rounded-full hover:bg-indigo-500"
          >
            <Copy size={14} /> 批量复制
          </button>
          <button
            onClick={() => {
              if (window.confirm(`确定要永久删除选中的 ${selectedIds.length} 个项目吗？`)) {
                deleteProjects(selectedIds);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded-full hover:bg-red-500"
          >
            <Trash2 size={14} /> 删除
          </button>
        </div>
      )}

      {/* 右键菜单 */}
      {cardContextMenu && (
        <div
          style={{ left: cardContextMenu.x, top: cardContextMenu.y }}
          className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl py-1.5 w-40 text-sm text-slate-700"
        >
          <button
            onClick={() => {
              setRenamingId(cardContextMenu.project.id);
              setRenameVal(cardContextMenu.project.name);
              setCardContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-100"
          >
            重命名
          </button>
          <button
            onClick={() => {
              setCoverTargetId(cardContextMenu.project.id);
              coverInputRef.current?.click();
              setCardContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-100"
          >
            设置封面
          </button>
          <button
            onClick={() => {
              duplicateProjects([cardContextMenu.project.id]);
              setCardContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-100"
          >
            创建副本
          </button>
          <button
            onClick={() => {
              if (window.confirm('确定删除此项目吗？')) {
                deleteProjects([cardContextMenu.project.id]);
              }
              setCardContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600"
          >
            删除项目
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".sb,.json" onChange={handleImportSB} className="hidden" />
      <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverFile} className="hidden" />
    </div>
  );
};