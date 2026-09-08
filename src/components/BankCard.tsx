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
    <div className="things-card things-card-interactive p-4 sm:p-6 flex flex-col justify-between group min-h-[190px] sm:min-h-[220px] bg-white rounded-xl sm:rounded-[18px]">
      <div>
        {/* 顶部标题与轻巧的操作入口 */}
        <div className="flex justify-between items-start mb-1 gap-2">
          {isEditing ? (
            <div className="flex items-center space-x-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-[15px] sm:text-[16px] font-bold text-[#303336] border border-[#2576eb] rounded-lg px-2.5 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-[#2576eb]"
                autoFocus
              />
              <button 
                onClick={handleRenameSubmit} 
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                title="确认重命名"
              >
                <Check className="w-4 h-4" />
              </button>
              <button 
                onClick={handleRenameCancel} 
                className="p-1.5 text-[#838b96] hover:bg-stone-100 rounded-lg cursor-pointer transition-colors"
                title="取消"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <h3 
                onClick={() => onBrowse(name)}
                className="font-bold text-[#303336] group-hover:text-[#2576eb] transition-colors truncate text-[16px] sm:text-[17px] tracking-tight cursor-pointer"
                title="点击全览题库"
              >
                {name}
              </h3>
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="opacity-70 sm:opacity-0 group-hover:opacity-100 text-[#838b96] hover:text-[#303336] p-1 rounded transition-opacity cursor-pointer shrink-0"
                title="重命名题库"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 右侧悬浮淡入的操作组 (导出 / 删除) */}
          <div 
            className={`flex items-center space-x-0.5 sm:space-x-1 shrink-0 transition-opacity duration-150 ${
              isConfirmingDelete ? 'opacity-100' : 'opacity-70 sm:opacity-0 group-hover:opacity-100'
            }`} 
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleExport}
              className="text-[#838b96] hover:text-[#303336] p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
              title="导出为 JSON 文件"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                  className="bg-stone-200 hover:bg-stone-300 text-stone-700 p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer"
                  title="取消"
                >
                  <X className="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="text-[#838b96] hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                title="删除此题库"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 元数据说明文本 */}
        <div className="text-[12px] sm:text-[13px] text-[#838b96] mt-0.5 mb-2.5 sm:mb-3.5 flex items-center gap-1.5 font-normal">
          <span>{stats.total} 题</span>
          {stats.chaptersCount && stats.chaptersCount > 1 && (
            <>
              <span className="text-[#dfe3e8]">·</span>
              <span>{stats.chaptersCount} 章</span>
            </>
          )}
        </div>

        {/* 静态题型标签：自动折行，间距设为 gap-1.5 */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-[12px] mb-2.5 sm:mb-3.5">
          {stats.single > 0 && (
            <span className="bg-[#f2f5f7] text-[#55606e] px-2 sm:px-2.5 py-0.5 rounded-full font-medium">
              单选 {stats.single}
            </span>
          )}
          {stats.multiple > 0 && (
            <span className="bg-[#f2f5f7] text-[#55606e] px-2 sm:px-2.5 py-0.5 rounded-full font-medium">
              多选 {stats.multiple}
            </span>
          )}
          {stats.judge > 0 && (
            <span className="bg-[#f2f5f7] text-[#55606e] px-2 sm:px-2.5 py-0.5 rounded-full font-medium">
              判断 {stats.judge}
            </span>
          )}
          {(stats.definition || 0) > 0 && (
            <span className="bg-[#f2f5f7] text-[#55606e] px-2 sm:px-2.5 py-0.5 rounded-full font-medium">
              名词 {stats.definition}
            </span>
          )}
          {(stats.blank || 0) > 0 && (
            <span className="bg-[#f2f5f7] text-[#55606e] px-2 sm:px-2.5 py-0.5 rounded-full font-medium">
              填空 {stats.blank}
            </span>
          )}
          {(stats.essay || 0) > 0 && (
            <span className="bg-[#f2f5f7] text-[#55606e] px-2 sm:px-2.5 py-0.5 rounded-full font-medium">
              论述 {stats.essay}
            </span>
          )}
        </div>

        {/* 业务动态状态：高亮胶囊醒目排布 */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          {dueSummary && (dueSummary.flashcardDueCount || 0) > 0 && (
            <div
              className="inline-flex items-center space-x-1 text-[11px] sm:text-[12px] px-2 sm:px-2.5 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200/70 font-medium"
              title="闪卡今日待复习"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>
                待复习 <strong className="font-semibold">{dueSummary.flashcardDueCount}</strong>
                {(dueSummary.flashcardOverdueCount || 0) > 0 && (
                  <span className="text-[10px] ml-1 text-rose-700 bg-rose-100 px-1 py-0.2 rounded font-medium">
                    {dueSummary.flashcardOverdueCount}超期
                  </span>
                )}
              </span>
            </div>
          )}

          {dueSummary && (dueSummary.flashcardDueCount || 0) === 0 && flashcardCount > 0 && (
            <div className="inline-flex items-center space-x-1 text-[11px] sm:text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 sm:px-2.5 py-0.5 rounded-full font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>今日已完成</span>
            </div>
          )}

          {wrongCount > 0 && (
            <div className="inline-flex items-center space-x-1 bg-rose-50 border border-rose-200/70 text-rose-700 text-[11px] sm:text-[12px] px-2 sm:px-2.5 py-0.5 rounded-full font-medium">
              <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
              <span>错题 <strong className="font-semibold">{wrongCount}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* 底部行动栏：移动端横向并排，做题与背卡自适应占据主要宽度，全览小屏幕简化为图标 */}
      <div className="pt-3 sm:pt-4 border-t border-[#dfe3e8]/70 flex items-center gap-1.5 sm:gap-2">
        {isDualTrack ? (
          <>
            <button
              onClick={() => onSelect(name, 'objective', 'test')}
              className="h-10 flex-1 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-2xs active:scale-[0.98] transition-all cursor-pointer min-w-0"
              title="开始刷题"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="truncate">刷题</span>
            </button>

            <button
              onClick={() => onSelect(name, 'flashcard', 'test')}
              className="h-10 flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-2xs active:scale-[0.98] transition-all cursor-pointer min-w-0"
              title="开始闪卡背卡"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">闪卡</span>
            </button>

            <button
              onClick={() => onBrowse(name)}
              className="h-10 px-3 sm:px-3.5 bg-[#f2f5f7] hover:bg-[#e4e8ec] text-[#55606e] hover:text-[#303336] rounded-lg text-xs sm:text-[13px] font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer shrink-0"
              title="查看全部题目"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">全览</span>
            </button>
          </>
        ) : isOnlyFlashcard ? (
          <>
            <button
              onClick={() => onSelect(name, 'flashcard', 'test')}
              className="h-10 flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center space-x-1.5 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
              title="进入闪卡背题"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>闪卡</span>
            </button>

            <button
              onClick={() => onBrowse(name)}
              className="h-10 px-3 sm:px-3.5 bg-[#f2f5f7] hover:bg-[#e4e8ec] text-[#55606e] hover:text-[#303336] rounded-lg text-xs sm:text-[13px] font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer shrink-0"
              title="查看全部题目"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">全览</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelect(name, 'objective', 'test')}
              className="h-10 flex-1 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center space-x-1.5 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
              title="开始刷题"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>刷题</span>
            </button>

            <button
              onClick={() => onBrowse(name)}
              className="h-10 px-3 sm:px-3.5 bg-[#f2f5f7] hover:bg-[#e4e8ec] text-[#55606e] hover:text-[#303336] rounded-lg text-xs sm:text-[13px] font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer shrink-0"
              title="查看全部题目"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">全览</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
