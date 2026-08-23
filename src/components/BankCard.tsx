import React, { useState } from 'react';
import { 
  BookOpen, 
  Trash2, 
  Download, 
  Edit2, 
  Check, 
  X, 
  Flame, 
  Eye, 
  Play 
} from 'lucide-react';
import { BankStats, Question, WrongBook } from '../types';

interface BankCardProps {
  name: string;
  stats: BankStats;
  wrongCount: number;
  questions: Question[];
  wrongBook: WrongBook;
  onSelect: (name: string, defaultPracticeMode?: 'test' | 'study') => void;
  onBrowse: (name: string) => void;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
}

export const BankCard: React.FC<BankCardProps> = ({
  name,
  stats,
  wrongCount,
  questions,
  onSelect,
  onBrowse,
  onDelete,
  onRename
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [newName, setNewName] = useState(name);

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = JSON.stringify(questions, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRenameSubmit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (newName.trim() && newName.trim() !== name) {
      onRename(name, newName.trim());
    }
    setIsEditing(false);
  };

  const handleRenameCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewName(name);
    setIsEditing(false);
  };

  return (
    <div className="group bg-white border border-stone-200/90 rounded-2xl p-5 hover:border-stone-400 hover:shadow-md transition-all flex flex-col justify-between relative shadow-xs">
      <div>
        {/* Card Header with Title and Actions */}
        <div className="flex justify-between items-start mb-3 gap-2">
          {isEditing ? (
            <div className="flex items-center space-x-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-sm font-semibold text-stone-800 border border-stone-300 rounded-lg px-2 py-1 flex-1 focus:outline-none focus:border-stone-900"
                autoFocus
              />
              <button onClick={handleRenameSubmit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={handleRenameCancel} className="p-1 text-stone-400 hover:bg-stone-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <h3 className="font-bold text-stone-800 truncate text-base group-hover:text-stone-950 transition-colors">
                {name}
              </h3>
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-700 p-0.5 rounded transition-all"
                title="重命名题库"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleExport}
              className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
              title="导出为 JSON 文件"
            >
              <Download className="w-4 h-4" />
            </button>
            {isConfirmingDelete ? (
              <div className="flex items-center space-x-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg animate-in fade-in duration-150">
                <span className="text-[11px] text-rose-700 font-medium">删题库?</span>
                <button
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    onDelete(name);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-xs"
                >
                  确定
                </button>
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  className="text-stone-500 hover:text-stone-800 px-1 py-0.5 text-[10px]"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                title="删除题库"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Question Type Statistics Badges */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs mb-4">
          <span className="bg-stone-100 text-stone-700 font-semibold px-2.5 py-0.5 rounded-md">
            共 {stats.total} 题
          </span>
          {stats.single > 0 && (
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">
              单选: {stats.single}
            </span>
          )}
          {stats.multiple > 0 && (
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-medium">
              多选: {stats.multiple}
            </span>
          )}
          {stats.judge > 0 && (
            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium">
              判断: {stats.judge}
            </span>
          )}
        </div>

        {/* Wrong Book pill if any */}
        {wrongCount > 0 && (
          <div className="mb-4 inline-flex items-center space-x-1.5 bg-rose-50 border border-rose-100 text-rose-600 text-xs px-2.5 py-1 rounded-lg">
            <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>待攻克错题：<strong className="font-bold">{wrongCount}</strong> 道</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-stone-100 flex items-center gap-2">
        <button
          onClick={() => onSelect(name, 'test')}
          className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-medium py-2 px-2.5 rounded-xl text-xs flex items-center justify-center space-x-1 active:scale-[0.98] transition-all shadow-xs"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>刷题</span>
        </button>

        <button
          onClick={() => onSelect(name, 'study')}
          className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium py-2 px-2.5 rounded-xl text-xs flex items-center justify-center space-x-1 active:scale-[0.98] transition-all border border-stone-200"
          title="直接展示答案与核心考点，用于零基础快速眼熟专业名词"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>速记</span>
        </button>

        <button
          onClick={() => onBrowse(name)}
          className="px-2.5 py-2 bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-900 font-medium rounded-xl text-xs flex items-center justify-center space-x-1 border border-stone-200/80 transition-colors"
          title="下滑全览整个题库、高亮答案与解析"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>全览</span>
        </button>
      </div>
    </div>
  );
};
