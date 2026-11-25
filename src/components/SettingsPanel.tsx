import React, { useState } from 'react';
import { X, Keyboard } from 'lucide-react';
import { ShortcutConfig } from '../types';
import { useProjectListStore } from '../store/useProjectListStore';

interface Props {
  onClose: () => void;
}

const SHORTCUT_LABELS: Record<keyof ShortcutConfig, string> = {
  undo: '全局撤销',
  redo: '全局重做',
  save: '立即保存',
  delete: '删除选中项',
  selectAll: '全选',
  confirmEdit: '确认文本编辑',
  toggleGrid: '切换背景网格'
};

export const SettingsPanel: React.FC<Props> = ({ onClose }) => {
  const { settings, updateSettings } = useProjectListStore();
  const [recordingKey, setRecordingKey] = useState<keyof ShortcutConfig | null>(null);

  const handleRecordKeyDown = (e: React.KeyboardEvent, key: keyof ShortcutConfig) => {
    e.preventDefault();
    e.stopPropagation();
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      parts.push(e.key);
    }
    if (parts.length > 0) {
      updateSettings({
        ...settings,
        shortcuts: {
          ...settings.shortcuts,
          [key]: parts.join('+')
        }
      });
      setRecordingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <Keyboard size={18} className="text-indigo-600" />
            <span>工作区与快捷键设置</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-slate-500 mb-2">
            点击下方按键框并按下新的组合键即可自定义快捷键：
          </p>
          {(Object.keys(SHORTCUT_LABELS) as (keyof ShortcutConfig)[]).map(k => (
            <div
              key={k}
              className="flex items-center justify-between py-2 border-b border-slate-100"
            >
              <span className="text-sm text-slate-700">{SHORTCUT_LABELS[k]}</span>
              <button
                onClick={() => setRecordingKey(k)}
                onKeyDown={e => recordingKey === k && handleRecordKeyDown(e, k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border min-w-[120px] text-center ${
                  recordingKey === k
                    ? 'bg-indigo-600 text-white border-indigo-600 animate-pulse'
                    : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {recordingKey === k ? '请按下快捷键...' : settings.shortcuts[k]}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};