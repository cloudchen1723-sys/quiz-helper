import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Play, 
  Shuffle, 
  Clock, 
  Zap, 
  BookOpen, 
  GraduationCap, 
  ChevronDown, 
  ChevronUp, 
  Settings2,
  FolderOpen,
  Tag,
  Sparkles,
  Calendar,
  Flame,
  Check
} from 'lucide-react';
import { SessionConfig, Question, WrongBook, BankStats, TrackMode, DueCardSummary } from '../types';

interface ConfigViewProps {
  bankName: string;
  questions: Question[];
  wrongBook: WrongBook;
  stats: BankStats;
  config: SessionConfig;
  dueSummary?: DueCardSummary;
  onChangeConfig: (newConfig: Partial<SessionConfig>) => void;
  onStart: () => void;
  onBrowse?: () => void;
  onBack: () => void;
  validationError?: string;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  bankName,
  questions,
  wrongBook,
  stats,
  config,
  dueSummary,
  onChangeConfig,
  onStart,
  onBrowse,
  onBack,
  validationError
}) => {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  // tag筛选默认折叠
  const [isTagsSectionOpen, setIsTagsSectionOpen] = useState(false);

  const maxQuestionId = Math.max(...questions.map((q) => q.id), 1);
  const wrongCount = Object.keys(wrongBook).length;

  const objectiveCount = stats.single + stats.multiple + stats.judge;
  const flashcardCount = (stats.blank || 0) + (stats.definition || 0) + (stats.essay || 0);
  const isDualTrack = objectiveCount > 0 && flashcardCount > 0;
  const activeTrack: TrackMode = config.trackMode || (objectiveCount > 0 ? 'objective' : 'flashcard');

  // 当前轨道下的所有题目列表
  const trackQuestions = useMemo(() => {
    if (activeTrack === 'objective') {
      return questions.filter(q => q.type === 'single' || q.type === 'multiple' || q.type === 'judge');
    }
    if (activeTrack === 'flashcard') {
      return questions.filter(q => q.type === 'blank' || q.type === 'definition' || q.type === 'essay');
    }
    return questions;
  }, [questions, activeTrack]);

  // 客观题错题数
  const objectiveWrongCount = useMemo(() => {
    const wrongIds = Object.keys(wrongBook).map(Number);
    return questions.filter(q => wrongIds.includes(q.id) && (q.type === 'single' || q.type === 'multiple' || q.type === 'judge')).length;
  }, [questions, wrongBook]);

  const flashcardDueCount = dueSummary?.flashcardDueCount || 0;
  const flashcardOverdueCount = dueSummary?.flashcardOverdueCount || 0;

  // 提取章节列表及每章题数 (基于当前轨道)
  const chapters = useMemo(() => {
    const map = new Map<string, number>();
    trackQuestions.forEach((q) => {
      const ch = q.chapter && q.chapter.trim() ? q.chapter.trim() : '未分类章节';
      map.set(ch, (map.get(ch) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [trackQuestions]);

  // 提取知识点标签列表及频次 (基于当前轨道)
  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    trackQuestions.forEach((q) => {
      if (Array.isArray(q.tags)) {
        q.tags.forEach((t) => {
          const tag = t.trim();
          if (tag) map.set(tag, (map.get(tag) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [trackQuestions]);

  const hasChapters = chapters.length > 1 || (chapters.length === 1 && chapters[0].name !== '未分类章节');

  // 实时估算当前配置过滤后的题目数
  const estimatedCount = useMemo(() => {
    let list = [...trackQuestions];

    if (activeTrack === 'objective') {
      if (config.filterMode === 'wrong') {
        const wrongIds = Object.keys(wrongBook).map(Number);
        const objWrongList = list.filter(q => wrongIds.includes(q.id));
        return objWrongList.length;
      } else if (config.filterMode === 'chapter') {
        if (config.selectedChapter && config.selectedChapter !== 'all') {
          list = list.filter(q => (q.chapter || '未分类章节') === config.selectedChapter);
        }
      } else if (config.filterMode === 'range') {
        const start = Math.max(1, config.rangeStart);
        const end = config.rangeEnd;
        list = list.filter(q => q.id >= start && q.id <= end);
      } else if (config.filterMode === 'mock') {
        const totalMock = (config.mockConfig.single || 0) + (config.mockConfig.multiple || 0) + (config.mockConfig.judge || 0);
        return Math.min(totalMock, list.length);
      }
    } else {
      // 闪卡轨道：今日复习（融合 SM-2 与生疏巩固）、全部闪卡、按章节
      if (config.filterMode === 'due') {
        const dueIds = dueSummary?.flashcardDueIds || dueSummary?.dueQuestionIds || [];
        const dueList = list.filter(q => dueIds.includes(q.id));
        return dueList.length > 0 ? dueList.length : Math.min(20, list.length);
      } else if (config.filterMode === 'chapter') {
        if (config.selectedChapter && config.selectedChapter !== 'all') {
          list = list.filter(q => (q.chapter || '未分类章节') === config.selectedChapter);
        }
      }
    }

    // 叠加标签过滤
    if (config.selectedTag && config.selectedTag !== 'all') {
      list = list.filter(q => Array.isArray(q.tags) && q.tags.includes(config.selectedTag!));
    }

    // 叠加题型过滤
    if (config.selectedType && config.selectedType !== 'all') {
      list = list.filter(q => q.type === config.selectedType);
    }

    return list.length;
  }, [trackQuestions, wrongBook, config, activeTrack, dueSummary]);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-xs p-5 md:p-7 max-w-2xl mx-auto w-full my-auto animate-in fade-in duration-150">
      {/* 头部标题与返回 */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-stone-100">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onBack}
            className="text-stone-400 hover:text-stone-800 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            title="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900">{bankName}</h2>
            <div className="flex items-center space-x-2 text-xs text-stone-400 mt-0.5">
              <span>共 {questions.length} 题</span>
              {stats.chaptersCount ? <span>• {stats.chaptersCount} 个章节</span> : null}
            </div>
          </div>
        </div>
        
        {onBrowse && (
          <button
            onClick={onBrowse}
            className="text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center space-x-1 shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>浏览题库</span>
          </button>
        )}
      </div>

      {/* 顶部极简分段开关 (客观题 vs 闪卡) */}
      {isDualTrack && (
        <div className="mb-5">
          <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-xl border border-stone-200/70">
            <button
              type="button"
              onClick={() => onChangeConfig({ 
                trackMode: 'objective', 
                selectedType: 'all',
                filterMode: config.filterMode === 'wrong' ? 'wrong' : config.filterMode
              })}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                activeTrack === 'objective'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <span>客观题</span>
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                activeTrack === 'objective' ? 'bg-stone-100 text-stone-700' : 'text-stone-400'
              }`}>
                {objectiveCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangeConfig({ 
                trackMode: 'flashcard', 
                selectedType: 'all',
                filterMode: (config.filterMode === 'wrong' || config.filterMode === 'mock' || config.filterMode === 'range') ? 'all' : config.filterMode
              })}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                activeTrack === 'flashcard'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <span>闪卡</span>
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                activeTrack === 'flashcard' ? 'bg-stone-100 text-stone-700' : 'text-stone-400'
              }`}>
                {flashcardCount}
              </span>
            </button>
          </div>

          {/* 题型构成轻量提示行 */}
          <div className="text-[11px] text-stone-400 text-center mt-1.5">
            {activeTrack === 'objective' ? (
              <span>单选 {stats.single} · 多选 {stats.multiple} · 判断 {stats.judge}</span>
            ) : (
              <span>填空 {stats.blank || 0} · 名词解释 {stats.definition || 0} · 论述 {stats.essay || 0}</span>
            )}
          </div>
        </div>
      )}

      {/* 客观题专属：做题模式 (做题 vs 背题) */}
      {activeTrack === 'objective' && (
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-700 mb-2">学习模式</label>
          <div className="grid grid-cols-2 gap-2.5">
            <label
              className={`p-2.5 sm:p-3 border rounded-xl cursor-pointer flex items-center space-x-2 transition-all ${
                config.practiceMode === 'test'
                  ? 'border-stone-900 bg-stone-50/70 ring-1 ring-stone-900 font-semibold text-stone-900'
                  : 'border-stone-200 hover:border-stone-300 text-stone-700'
              }`}
            >
              <input
                type="radio"
                name="practiceMode"
                checked={config.practiceMode === 'test'}
                onChange={() => onChangeConfig({ practiceMode: 'test' })}
                className="text-stone-900 focus:ring-stone-900"
              />
              <span className="text-xs sm:text-sm flex items-center">
                <GraduationCap className="w-4 h-4 mr-1.5 text-stone-700 shrink-0" />
                做题 (测验)
              </span>
            </label>

            <label
              className={`p-2.5 sm:p-3 border rounded-xl cursor-pointer flex items-center space-x-2 transition-all ${
                config.practiceMode === 'study'
                  ? 'border-stone-900 bg-stone-50/70 ring-1 ring-stone-900 font-semibold text-stone-900'
                  : 'border-stone-200 hover:border-stone-300 text-stone-700'
              }`}
            >
              <input
                type="radio"
                name="practiceMode"
                checked={config.practiceMode === 'study'}
                onChange={() => onChangeConfig({ practiceMode: 'study' })}
                className="text-stone-900 focus:ring-stone-900"
              />
              <span className="text-xs sm:text-sm flex items-center">
                <BookOpen className="w-4 h-4 mr-1.5 text-amber-600 shrink-0" />
                背题 (速记)
              </span>
            </label>
          </div>
        </div>
      )}

      {/* 出题范围 */}
      <div className="space-y-2 mb-5">
        <label className="block text-xs font-semibold text-stone-700 mb-1.5">出题范围</label>
        
        {/* 闪卡专属：今日复习 (融合 SM-2 智能到期与生疏巩固) */}
        {activeTrack === 'flashcard' && (
          <label
            className={`flex items-center p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
              config.filterMode === 'due'
                ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600'
                : 'border-stone-200 hover:bg-stone-50/60'
            }`}
          >
            <input
              type="radio"
              name="filterMode"
              checked={config.filterMode === 'due'}
              onChange={() => onChangeConfig({ filterMode: 'due' })}
              className="text-purple-600 focus:ring-purple-600"
            />
            <div className="ml-2.5 flex items-center justify-between w-full">
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="font-semibold text-stone-900 text-xs sm:text-sm">
                  今日复习
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                {flashcardOverdueCount > 0 && (
                  <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">
                    {flashcardOverdueCount}超期
                  </span>
                )}
                {flashcardDueCount > 0 ? (
                  <span className="bg-purple-100 text-purple-700 text-[11px] px-2.5 py-0.5 rounded-full font-bold font-mono">
                    {flashcardDueCount} 张
                  </span>
                ) : (
                  <span className="text-xs text-emerald-600 font-medium flex items-center">
                    <Check className="w-3.5 h-3.5 mr-0.5" />
                    今日已完成
                  </span>
                )}
              </div>
            </div>
          </label>
        )}

        {/* 全部题目 / 全部闪卡 */}
        <label
          className={`flex items-center p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
            config.filterMode === 'all'
              ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
              : 'border-stone-200 hover:bg-stone-50/50'
          }`}
        >
          <input
            type="radio"
            name="filterMode"
            checked={config.filterMode === 'all'}
            onChange={() => onChangeConfig({ filterMode: 'all' })}
            className="text-stone-900 focus:ring-stone-900"
          />
          <div className="ml-2.5 flex items-center justify-between w-full">
            <span className="font-medium text-stone-800 text-xs sm:text-sm">
              {activeTrack === 'flashcard' ? '全部闪卡' : '全部题目'}
            </span>
            <span className="text-xs text-stone-400 font-mono">{trackQuestions.length} 题</span>
          </div>
        </label>

        {/* 按章节 */}
        <label
          className={`flex flex-col p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
            config.filterMode === 'chapter'
              ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
              : 'border-stone-200 hover:bg-stone-50/50'
          }`}
        >
          <div className="flex items-center">
            <input
              type="radio"
              name="filterMode"
              checked={config.filterMode === 'chapter'}
              onChange={() => {
                onChangeConfig({ 
                  filterMode: 'chapter',
                  selectedChapter: config.selectedChapter || (chapters[0] ? chapters[0].name : 'all')
                });
              }}
              className="text-stone-900 focus:ring-stone-900"
            />
            <div className="ml-2.5 flex items-center justify-between w-full">
              <span className="font-medium text-stone-800 text-xs sm:text-sm flex items-center">
                <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-stone-600" />
                按章节
              </span>
              <span className="text-xs text-stone-400">
                {hasChapters ? `${chapters.length} 个章节` : '综合单章'}
              </span>
            </div>
          </div>

          {config.filterMode === 'chapter' && (
            <div className="mt-2.5 ml-6 pt-2 border-t border-stone-100" onClick={(e) => e.stopPropagation()}>
              <div className="text-xs text-stone-500 mb-1.5 font-medium">选择目标章节：</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {chapters.map((ch) => {
                  const isSelected = (config.selectedChapter || 'all') === ch.name;
                  return (
                    <button
                      key={ch.name}
                      type="button"
                      onClick={() => onChangeConfig({ selectedChapter: ch.name })}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between border ${
                        isSelected 
                          ? 'bg-stone-900 border-stone-900 text-white font-semibold' 
                          : 'bg-white border-stone-200 hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      <span className="truncate mr-2">{ch.name}</span>
                      <span className={`text-[11px] font-mono shrink-0 ${isSelected ? 'text-stone-300' : 'text-stone-400'}`}>
                        {ch.count} 题
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </label>

        {/* 客观题专属：错题本 (纯错题，去除 SM-2) */}
        {activeTrack === 'objective' && (
          <label
            className={`flex items-center p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
              config.filterMode === 'wrong'
                ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
                : 'border-stone-200 hover:bg-stone-50/50'
            }`}
          >
            <input
              type="radio"
              name="filterMode"
              checked={config.filterMode === 'wrong'}
              onChange={() => onChangeConfig({ filterMode: 'wrong' })}
              className="text-stone-900 focus:ring-stone-900"
            />
            <div className="ml-2.5 flex items-center justify-between w-full">
              <span className="font-medium text-stone-800 text-xs sm:text-sm flex items-center">
                <Flame className="w-3.5 h-3.5 mr-1.5 text-rose-500 fill-rose-500" />
                错题本
              </span>
              {objectiveWrongCount > 0 ? (
                <span className="bg-rose-100 text-rose-700 text-[11px] px-2 py-0.5 rounded-full font-semibold font-mono">
                  {objectiveWrongCount} 题
                </span>
              ) : (
                <span className="text-xs text-stone-400">暂无错题</span>
              )}
            </div>
          </label>
        )}

        {/* 客观题专属：随机组卷 */}
        {activeTrack === 'objective' && (
          <label
            className={`flex flex-col p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
              config.filterMode === 'mock'
                ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
                : 'border-stone-200 hover:bg-stone-50/50'
            }`}
          >
            <div className="flex items-center">
              <input
                type="radio"
                name="filterMode"
                checked={config.filterMode === 'mock'}
                onChange={() => onChangeConfig({ filterMode: 'mock' })}
                className="text-stone-900 focus:ring-stone-900"
              />
              <div className="ml-2.5 flex items-center justify-between w-full">
                <span className="font-medium text-stone-800 text-xs sm:text-sm">随机抽题组卷</span>
                <span className="text-xs text-stone-400">
                  已配 {(config.mockConfig.single || 0) + (config.mockConfig.multiple || 0) + (config.mockConfig.judge || 0)} 题
                </span>
              </div>
            </div>
            {config.filterMode === 'mock' && (
              <div className="flex flex-wrap items-center gap-3 mt-2.5 ml-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-stone-500">单选:</span>
                  <input
                    type="number"
                    min={0}
                    max={stats.single}
                    value={config.mockConfig.single}
                    onChange={(e) => onChangeConfig({
                      mockConfig: { ...config.mockConfig, single: Math.max(0, parseInt(e.target.value) || 0) }
                    })}
                    className="w-14 px-2 py-1 text-xs border border-stone-300 rounded-lg text-center"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-stone-500">多选:</span>
                  <input
                    type="number"
                    min={0}
                    max={stats.multiple}
                    value={config.mockConfig.multiple}
                    onChange={(e) => onChangeConfig({
                      mockConfig: { ...config.mockConfig, multiple: Math.max(0, parseInt(e.target.value) || 0) }
                    })}
                    className="w-14 px-2 py-1 text-xs border border-stone-300 rounded-lg text-center"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-stone-500">判断:</span>
                  <input
                    type="number"
                    min={0}
                    max={stats.judge}
                    value={config.mockConfig.judge}
                    onChange={(e) => onChangeConfig({
                      mockConfig: { ...config.mockConfig, judge: Math.max(0, parseInt(e.target.value) || 0) }
                    })}
                    className="w-14 px-2 py-1 text-xs border border-stone-300 rounded-lg text-center"
                  />
                </div>
              </div>
            )}
          </label>
        )}

        {/* 客观题专属：指定题号区间 */}
        {activeTrack === 'objective' && (
          <label
            className={`flex flex-col p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
              config.filterMode === 'range'
                ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
                : 'border-stone-200 hover:bg-stone-50/50'
            }`}
          >
            <div className="flex items-center">
              <input
                type="radio"
                name="filterMode"
                checked={config.filterMode === 'range'}
                onChange={() => onChangeConfig({ filterMode: 'range' })}
                className="text-stone-900 focus:ring-stone-900"
              />
              <div className="ml-2.5 flex items-center justify-between w-full">
                <span className="font-medium text-stone-800 text-xs sm:text-sm">指定题号区间</span>
                <span className="text-xs text-stone-400 font-mono">1 - {maxQuestionId}</span>
              </div>
            </div>
            {config.filterMode === 'range' && (
              <div className="flex items-center space-x-2 mt-2.5 ml-6" onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  min={1}
                  max={maxQuestionId}
                  value={config.rangeStart}
                  onChange={(e) => onChangeConfig({ rangeStart: parseInt(e.target.value) || 1 })}
                  className="w-20 px-2.5 py-1 text-xs border border-stone-300 rounded-lg text-center focus:outline-none focus:border-stone-900"
                />
                <span className="text-stone-400 text-xs">至</span>
                <input
                  type="number"
                  min={config.rangeStart}
                  max={maxQuestionId}
                  value={config.rangeEnd}
                  onChange={(e) => onChangeConfig({ rangeEnd: parseInt(e.target.value) || maxQuestionId })}
                  className="w-20 px-2.5 py-1 text-xs border border-stone-300 rounded-lg text-center focus:outline-none focus:border-stone-900"
                />
                <span className="text-xs text-stone-400">题</span>
              </div>
            )}
          </label>
        )}
      </div>

      {/* 知识点 Tag 胶囊筛选区 (按照需求：默认折叠) */}
      {allTags.length > 0 && (
        <div className="mb-5 border border-stone-200/80 rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setIsTagsSectionOpen(!isTagsSectionOpen)}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-xs text-stone-600 hover:text-stone-900 bg-stone-50/60 hover:bg-stone-100/60 transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <Tag className="w-3.5 h-3.5 text-stone-400" />
              <span className="font-medium">知识点标签筛选</span>
              {config.selectedTag && config.selectedTag !== 'all' ? (
                <span className="bg-stone-900 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  #{config.selectedTag}
                </span>
              ) : (
                <span className="text-stone-400 text-[11px]">（共 {allTags.length} 个）</span>
              )}
            </div>
            <div className="flex items-center space-x-1 text-stone-400 text-[11px]">
              <span>{isTagsSectionOpen ? '收起' : '展开'}</span>
              {isTagsSectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {isTagsSectionOpen && (
            <div className="p-3 border-t border-stone-100 animate-in fade-in duration-150">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeConfig({ selectedTag: 'all' })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    !config.selectedTag || config.selectedTag === 'all'
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  全部标签
                </button>
                {allTags.map(([tag, count]) => {
                  const isSelected = config.selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onChangeConfig({ selectedTag: isSelected ? 'all' : tag })}
                      className={`px-2 py-1 rounded-lg text-xs transition-colors flex items-center space-x-1 border ${
                        isSelected
                          ? 'bg-stone-900 border-stone-900 text-white font-medium shadow-2xs'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <span>#{tag}</span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-stone-300' : 'text-stone-400'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 练习辅助设置 (乱序 / 计时 / 自动切题) */}
      <div className="mb-5 pt-2 border-t border-stone-100">
        <button
          type="button"
          onClick={() => setIsOptionsOpen(!isOptionsOpen)}
          className="w-full flex items-center justify-between text-xs text-stone-500 hover:text-stone-800 py-1 px-1 rounded-lg transition-colors font-medium"
        >
          <div className="flex items-center space-x-1.5">
            <Settings2 className="w-3.5 h-3.5 text-stone-400" />
            <span>练习设置</span>
            {(config.isShuffled || config.useTimer || (activeTrack !== 'flashcard' && config.autoNextOnCorrect)) && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-700 ml-1"></span>
            )}
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-stone-400">
            <span>{isOptionsOpen ? '收起' : '展开'}</span>
            {isOptionsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {isOptionsOpen && (
          <div className={`grid ${activeTrack === 'flashcard' ? 'grid-cols-2' : 'grid-cols-3'} gap-2 mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150`}>
            <label className="flex items-center justify-center space-x-1.5 cursor-pointer bg-stone-50 hover:bg-stone-100/80 px-2 py-2 rounded-lg border border-stone-200 transition-colors">
              <input
                type="checkbox"
                checked={config.isShuffled}
                onChange={(e) => onChangeConfig({ isShuffled: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-stone-900 focus:ring-stone-900"
              />
              <span className="text-xs font-medium text-stone-800 flex items-center whitespace-nowrap">
                <Shuffle className="w-3 h-3 mr-1 text-stone-500 shrink-0" />
                随机乱序
              </span>
            </label>

            <label className="flex items-center justify-center space-x-1.5 cursor-pointer bg-stone-50 hover:bg-stone-100/80 px-2 py-2 rounded-lg border border-stone-200 transition-colors">
              <input
                type="checkbox"
                checked={config.useTimer}
                onChange={(e) => onChangeConfig({ useTimer: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-stone-900 focus:ring-stone-900"
              />
              <span className="text-xs font-medium text-stone-800 flex items-center whitespace-nowrap">
                <Clock className="w-3 h-3 mr-1 text-stone-500 shrink-0" />
                计时
              </span>
            </label>

            {activeTrack !== 'flashcard' && (
              <label className="flex items-center justify-center space-x-1.5 cursor-pointer bg-stone-50 hover:bg-stone-100/80 px-2 py-2 rounded-lg border border-stone-200 transition-colors">
                <input
                  type="checkbox"
                  checked={config.autoNextOnCorrect}
                  onChange={(e) => onChangeConfig({ autoNextOnCorrect: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-stone-900 focus:ring-stone-900"
                />
                <span className="text-xs font-medium text-stone-800 flex items-center whitespace-nowrap">
                  <Zap className="w-3 h-3 mr-1 text-amber-500 shrink-0" />
                  自动跳题
                </span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* 验证错误提示 */}
      {validationError && (
        <div className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
          {validationError}
        </div>
      )}

      {/* 开始按钮 */}
      <button
        onClick={onStart}
        disabled={estimatedCount === 0}
        className={`w-full font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-xs ${
          estimatedCount > 0
            ? 'bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white cursor-pointer'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
        }`}
      >
        <Play className="w-4 h-4 fill-current" />
        <span>
          {estimatedCount === 0 
            ? '当前筛选无匹配题目' 
            : activeTrack === 'flashcard'
              ? (config.filterMode === 'due'
                  ? `开始复习 (${estimatedCount})`
                  : `开始背卡 (${estimatedCount})`)
              : (config.filterMode === 'wrong'
                  ? `开始错题 (${estimatedCount})`
                  : `开始做题 (${estimatedCount})`)}
        </span>
      </button>
    </div>
  );
};
