import React, { useState } from 'react';
import { 
  BookOpen, 
  Trash2, 
  Download, 
  Edit2, 
  Check, 
  X, 
  Flame, 
  Layers,
  Play,
  Clock,
  Calendar,
  Sparkles
} from 'lucide-react';
import { BankStats, Question, WrongBook, TrackMode, DueCardSummary } from '../types';

interface BankCardProps {
  name: string;
  stats: BankStats;
  wrongCount: number;
  questions: Question[];
  wrongBook: WrongBook;
  dueSummary?: DueCardSummary;
  onSelect: (name: string, trackMode: TrackMode, defaultPracticeMode?: 'test' | 'study') => void;
  onBrowse: (name: string) => void;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
}

export const BankCard: React.FC<BankCardProps> = ({
  name,
  stats,
  wrongCount,
  questions,
  dueSummary,
  onSelect,
  onBrowse,
  onDelete,
  onRename
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [newName, setNewName] = useState(name);

  const objectiveCount = stats.single + stats.multiple + stats.judge;
  const flashcardCount = (stats.blank || 0) + (stats.definition || 0) + (stats.essay || 0);
  const isDualTrack = objectiveCount > 0 && flashcardCount > 0;
  const isOnlyObjective = objectiveCount > 0 && flashcardCount === 0;
  const isOnlyFlashcard = objectiveCount === 0 && flashcardCount > 0;

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
    <div className="group bg-white border border-black/[0.08] rounded-xl p-5 hover:border-black/20 transition-all flex flex-col justify-between relative">
      <div>
        {/* 头部：标题与右侧 hover 淡入的操作图标 */}
        <div className="flex justify-between items-start mb-1 gap-2">
          {isEditing ? (
            <div className="flex items-center space-x-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-sm font-semibold text-black/90 border border-black/20 rounded-lg px-2 py-1 flex-1 focus:outline-none focus:border-black"
                autoFocus
              />
              <button onClick={handleRenameSubmit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={handleRenameCancel} className="p-1 text-black/40 hover:bg-black/5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <h3 className="font-semibold text-black/90 truncate text-base">
                {name}
              </h3>
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-black/80 p-0.5 rounded transition-all"
                title="重命名题库"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div 
            className={`flex items-center space-x-1 shrink-0 transition-opacity ${
              isConfirmingDelete ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`} 
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleExport}
              className="text-black/40 hover:text-black/80 p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors"
              title="导出"
            >
              <Download className="w-4 h-4" />
            </button>
            {isConfirmingDelete ? (
              <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-lg animate-in fade-in duration-150">
                <span className="text-[11px] text-rose-700 font-medium mr-0.5">确认删除?</span>
                <button
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    onDelete(name);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer"
                  title="确认删除"
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </button>
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  className="bg-black/10 hover:bg-black/20 text-black/70 p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer"
                  title="取消"
                >
                  <X className="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="text-black/40 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 元数据：标题下方的浅灰单行说明文本（如“30题 · 9章”） */}
        <div className="text-xs text-black/50 mb-3 flex items-center gap-1.5">
          <span>{stats.total} 题</span>
          {stats.chaptersCount && stats.chaptersCount > 1 && (
            <>
              <span>·</span>
              <span>{stats.chaptersCount} 章</span>
            </>
          )}
        </div>

        {/* 静态题型标签：极低饱和度浅灰胶囊 */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
          {stats.single > 0 && (
            <span className="bg-black/5 text-black/60 px-2 py-0.5 rounded-full text-[11px]">
              单选 {stats.single}
            </span>
          )}
          {stats.multiple > 0 && (
            <span className="bg-black/5 text-black/60 px-2 py-0.5 rounded-full text-[11px]">
              多选 {stats.multiple}
            </span>
          )}
          {stats.judge > 0 && (
            <span className="bg-black/5 text-black/60 px-2 py-0.5 rounded-full text-[11px]">
              判断 {stats.judge}
            </span>
          )}
          {(stats.definition || 0) > 0 && (
            <span className="bg-black/5 text-black/60 px-2 py-0.5 rounded-full text-[11px]">
              名词 {stats.definition}
            </span>
          )}
          {(stats.blank || 0) > 0 && (
            <span className="bg-black/5 text-black/60 px-2 py-0.5 rounded-full text-[11px]">
              填空 {stats.blank}
            </span>
          )}
          {(stats.essay || 0) > 0 && (
            <span className="bg-black/5 text-black/60 px-2 py-0.5 rounded-full text-[11px]">
              论述 {stats.essay}
            </span>
          )}
        </div>

        {/* 业务动态状态：高亮胶囊醒目排布 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {dueSummary && (dueSummary.flashcardDueCount || 0) > 0 && (
            <div
              className="inline-flex items-center space-x-1.5 text-xs px-2.5 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200/60 font-medium"
              title="闪卡今日待复习"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>
                待复习 <strong className="font-bold">{dueSummary.flashcardDueCount}</strong>
                {(dueSummary.flashcardOverdueCount || 0) > 0 && (
                  <span className="text-[10px] ml-1 text-rose-700 bg-rose-100 px-1 py-0.2 rounded font-medium">
                    {dueSummary.flashcardOverdueCount}超期
                  </span>
                )}
              </span>
            </div>
          )}

          {dueSummary && (dueSummary.flashcardDueCount || 0) === 0 && flashcardCount > 0 && (
            <div className="inline-flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full font-medium">
              <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>今日已完成</span>
            </div>
          )}

          {wrongCount > 0 && (
            <div className="inline-flex items-center space-x-1.5 bg-rose-50 border border-rose-200/60 text-rose-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
              <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
              <span>错题 <strong className="font-bold">{wrongCount}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* 底部行动栏：墨绿/深紫主按钮 + 极简线框副按钮 */}
      <div className="pt-3 border-t border-black/[0.06] flex items-center gap-2">
        {isDualTrack ? (
          <>
            <button
              onClick={() => onSelect(name, 'objective', 'test')}
              className="flex-1 bg-[#0f766e] hover:bg-[#0d665f] text-white font-bold py-2 px-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 active:scale-[0.98] transition-all cursor-pointer"
              title="开始做题"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>做题 ({objectiveCount})</span>
            </button>

            <button
              onClick={() => onSelect(name, 'flashcard', 'test')}
              className="flex-1 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-bold py-2 px-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 active:scale-[0.98] transition-all cursor-pointer"
              title="开始背卡"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>背卡 ({flashcardCount})</span>
            </button>

            <button
              onClick={() => onBrowse(name)}
              className="px-3 py-2 bg-transparent hover:bg-black/5 text-black/80 font-medium rounded-lg text-xs flex items-center justify-center space-x-1 border border-black/10 transition-colors shrink-0 cursor-pointer"
              title="查看全部题目"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>全览</span>
            </button>
          </>
        ) : isOnlyFlashcard ? (
          <>
            <button
              onClick={() => onSelect(name, 'flashcard', 'test')}
              className="flex-1 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-bold py-2 px-2.5 rounded-lg text-xs flex items-center justify-center space-x-1.5 active:scale-[0.98] transition-all cursor-pointer"
              title="进入闪卡背题"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>背卡 ({flashcardCount})</span>
            </button>

            <button
              onClick={() => onBrowse(name)}
              className="px-3 py-2 bg-transparent hover:bg-black/5 text-black/80 font-medium rounded-lg text-xs flex items-center justify-center space-x-1 border border-black/10 transition-colors shrink-0 cursor-pointer"
              title="查看全部题目"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>全览</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelect(name, 'objective', 'test')}
              className="flex-1 bg-[#0f766e] hover:bg-[#0d665f] text-white font-bold py-2 px-2.5 rounded-lg text-xs flex items-center justify-center space-x-1.5 active:scale-[0.98] transition-all cursor-pointer"
              title="开始做题"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>做题 ({objectiveCount})</span>
            </button>

            <button
              onClick={() => onBrowse(name)}
              className="px-3 py-2 bg-transparent hover:bg-black/5 text-black/80 font-medium rounded-lg text-xs flex items-center justify-center space-x-1 border border-black/10 transition-colors shrink-0 cursor-pointer"
              title="查看全部题目"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>全览</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
