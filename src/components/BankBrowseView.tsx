import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, 
  BookOpen, 
  Check, 
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Layers,
  Play,
  RotateCcw,
  CheckCircle2,
  Pencil
} from 'lucide-react';
import { Question, WrongBook, BankStats, QuestionType } from '../types';

interface BankBrowseViewProps {
  bankName: string;
  questions: Question[];
  wrongBook: WrongBook;
  masteredIds?: number[];
  stats: BankStats;
  onBack: () => void;
  onStartPractice: (mode: 'test' | 'study') => void;
  onRemoveFromWrongBook?: (questionId: number) => Promise<void> | void;
  onToggleMastered?: (questionId: number, isMastered: boolean) => Promise<void> | void;
  onDeleteQuestion?: (questionId: number) => Promise<void> | void;
  onUpdateQuestion?: (updatedQuestion: Question) => Promise<void> | void;
}

export const BankBrowseView: React.FC<BankBrowseViewProps> = ({
  bankName,
  questions,
  wrongBook,
  masteredIds = [],
  stats: _stats,
  onBack,
  onStartPractice,
  onRemoveFromWrongBook,
  onToggleMastered,
  onDeleteQuestion,
  onUpdateQuestion
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [filterType, setFilterType] = useState<'all' | QuestionType>('all');
  const [filterChapter, setFilterChapter] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpracticed' | 'mastered' | 'wrong'>('all');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  // 底部修改与管理操作折叠状态（默认全部折叠，避免影响快速浏览）
  const [expandedActionIds, setExpandedActionIds] = useState<Set<number>>(new Set());
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteQuestionId, setConfirmDeleteQuestionId] = useState<number | null>(null);

  const toggleActionBar = (qId: number) => {
    setExpandedActionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  // 原地修改 (Inline Edit) 状态
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<{
    id: number;
    question: string;
    type: QuestionType;
    options: Record<string, string>;
    answer: string | string[];
    analysis: string;
    chapter?: string;
    tags?: string[];
  } | null>(null);

  const showFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 2500);
  };

  const handleOpenSearch = () => {
    setIsSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 60);
  };

  const handleSearchClose = () => {
    setSearchKeyword('');
    setIsSearchOpen(false);
  };

  const handleSearchBlur = () => {
    if (!searchKeyword.trim()) {
      setIsSearchOpen(false);
    }
  };

  const toggleExpand = (id: number) => {
    // 如果正在编辑当前题，不触发折叠
    if (editingQuestionId === id) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const masteredSet = useMemo(() => new Set(masteredIds), [masteredIds]);

  // 判断单道题目的状态：错题(wrong) > 已掌握(mastered) > 未练习(unpracticed)
  const getQuestionStatus = (id: number): 'wrong' | 'mastered' | 'unpracticed' => {
    if (wrongBook[id]) return 'wrong';
    if (masteredSet.has(id)) return 'mastered';
    return 'unpracticed';
  };

  // 章节列表
  const chaptersList = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.chapter && q.chapter.trim()) set.add(q.chapter.trim());
    });
    return Array.from(set);
  }, [questions]);

  // 标签/考点列表
  const tagsList = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach((q) => {
      if (Array.isArray(q.tags)) {
        q.tags.forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) map.set(trimmed, (map.get(trimmed) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [questions]);

  // 状态数量与题型分布统计（随当前章节与考点筛选动态联动）
  const scopedQuestionsForTypes = useMemo(() => {
    return questions.filter((q) => {
      if (filterChapter !== 'all') {
        const ch = q.chapter || '未分类章节';
        if (ch !== filterChapter) return false;
      }
      if (filterTag !== 'all') {
        if (!Array.isArray(q.tags) || !q.tags.includes(filterTag)) return false;
      }
      return true;
    });
  }, [questions, filterChapter, filterTag]);

  // 动态题型统计
  const dynamicTypeStats = useMemo(() => {
    let single = 0;
    let multiple = 0;
    let judge = 0;
    let blank = 0;
    let definition = 0;
    let essay = 0;

    scopedQuestionsForTypes.forEach((q) => {
      if (q.type === 'single') single++;
      else if (q.type === 'multiple') multiple++;
      else if (q.type === 'judge') judge++;
      else if (q.type === 'blank') blank++;
      else if (q.type === 'definition') definition++;
      else if (q.type === 'essay') essay++;
    });

    return {
      total: scopedQuestionsForTypes.length,
      single,
      multiple,
      judge,
      blank,
      definition,
      essay
    };
  }, [scopedQuestionsForTypes]);

  // 当前分类及题型范围内的题目（用于“做题状态”统计联动）
  const scopedQuestionsForStatus = useMemo(() => {
    return scopedQuestionsForTypes.filter((q) => {
      if (filterType !== 'all' && q.type !== filterType) return false;
      return true;
    });
  }, [scopedQuestionsForTypes, filterType]);

  // 动态状态统计
  const wrongCount = useMemo(() => {
    return scopedQuestionsForStatus.filter((q) => !!wrongBook[q.id]).length;
  }, [scopedQuestionsForStatus, wrongBook]);

  const masteredCount = useMemo(() => {
    return scopedQuestionsForStatus.filter((q) => !wrongBook[q.id] && masteredSet.has(q.id)).length;
  }, [scopedQuestionsForStatus, wrongBook, masteredSet]);

  const unpracticedCount = Math.max(0, scopedQuestionsForStatus.length - wrongCount - masteredCount);

  // 最终过滤题目
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 搜索关键字
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const inQ = q.question.toLowerCase().includes(kw);
        const inA = (q.analysis || '').toLowerCase().includes(kw);
        const inOpts = Object.values(q.options || {}).some((v) => v.toLowerCase().includes(kw));
        const inKeyPoints = (q.keyPoints || []).some((k) => k.toLowerCase().includes(kw));
        const inAnswer = typeof q.answer === 'string' ? q.answer.toLowerCase().includes(kw) : false;
        if (!inQ && !inA && !inOpts && !inKeyPoints && !inAnswer && !q.id.toString().includes(kw)) {
          return false;
        }
      }

      // 题型过滤
      if (filterType !== 'all' && q.type !== filterType) {
        return false;
      }

      // 章节过滤
      if (filterChapter !== 'all') {
        const ch = q.chapter || '未分类章节';
        if (ch !== filterChapter) return false;
      }

      // 考点过滤
      if (filterTag !== 'all') {
        if (!Array.isArray(q.tags) || !q.tags.includes(filterTag)) return false;
      }

      // 状态过滤
      const status = getQuestionStatus(q.id);
      if (filterStatus === 'wrong' && status !== 'wrong') return false;
      if (filterStatus === 'mastered' && status !== 'mastered') return false;
      if (filterStatus === 'unpracticed' && status !== 'unpracticed') return false;

      return true;
    });
  }, [questions, wrongBook, masteredSet, searchKeyword, filterType, filterChapter, filterTag, filterStatus]);

  const getTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'single':
        return { label: '单选', bg: 'bg-blue-50 text-blue-700 border-blue-200/70' };
      case 'multiple':
        return { label: '多选', bg: 'bg-purple-50 text-purple-700 border-purple-200/70' };
      case 'judge':
        return { label: '判断', bg: 'bg-amber-50 text-amber-700 border-amber-200/70' };
      case 'blank':
        return { label: '填空', bg: 'bg-teal-50 text-teal-700 border-teal-200/70' };
      case 'definition':
        return { label: '名词', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/70' };
      case 'essay':
        return { label: '论述', bg: 'bg-rose-50 text-rose-700 border-rose-200/70' };
      default:
        return { label: '题目', bg: 'bg-stone-100 text-stone-700 border-stone-200/70' };
    }
  };

  // 生成折叠状态下客观题/主观题/判断题直接显示的纯正确答案文本
  const getDirectCleanAnswer = (q: Question) => {
    // 1. 判断题：直接返回绿色勾或红色叉
    if (q.type === 'judge') {
      const rawAns = typeof q.answer === 'string' ? q.answer.trim().toUpperCase() : String(q.answer);
      const isTrue = rawAns === 'T' || rawAns === 'TRUE' || rawAns === '正确' || rawAns === '对' || rawAns === '1' || rawAns === '√';
      return {
        isJudge: true,
        isTrue,
        text: isTrue ? '正确' : '错误'
      };
    }

    // 2. 带有 options 的选择题：去掉 "答案 B:"，直接提取选项文本内容
    if (q.options && Object.keys(q.options).length > 0) {
      const letters = typeof q.answer === 'string' ? q.answer.toUpperCase().trim() : '';
      if (letters.length === 1 && q.options[letters]) {
        return {
          isJudge: false,
          text: q.options[letters]
        };
      }
      // 多选题：合并多个正确选项的内容
      if (letters.length > 1) {
        const optionTexts = letters
          .split('')
          .map((letter) => q.options?.[letter])
          .filter(Boolean);
        if (optionTexts.length > 0) {
          return {
            isJudge: false,
            text: optionTexts.join('；')
          };
        }
      }
      return {
        isJudge: false,
        text: letters
      };
    }

    // 3. 填空题
    if (Array.isArray(q.answer)) {
      return {
        isJudge: false,
        text: q.answer.join(' / ')
      };
    }

    // 4. 其他题目
    return {
      isJudge: false,
      text: q.answer ? String(q.answer) : ''
    };
  };

  // 状态点击操作：红点/绿点支持直接重置/移出错题
  const handleDotClick = async (e: React.MouseEvent, qId: number, status: 'wrong' | 'mastered' | 'unpracticed') => {
    e.stopPropagation();
    if (status === 'wrong') {
      if (onRemoveFromWrongBook) {
        await onRemoveFromWrongBook(qId);
        showFeedback(`已将 #${qId} 移出错题本`);
      }
    } else if (status === 'mastered') {
      if (onToggleMastered) {
        await onToggleMastered(qId, false);
        showFeedback(`已将 #${qId} 重置为未练习`);
      }
    } else {
      if (onToggleMastered) {
        await onToggleMastered(qId, true);
        showFeedback(`已将 #${qId} 标记为已掌握`);
      }
    }
  };

  // --- 原地编辑交互逻辑 (Inline Edit) ---
  const handleStartEdit = (e: React.MouseEvent, q: Question) => {
    e.stopPropagation();
    setEditingQuestionId(q.id);

    // 确保 options 至少有默认的基础配置，或深拷贝现有选项
    const existingOpts = q.options ? { ...q.options } : {};
    if (q.type === 'single' || q.type === 'multiple') {
      if (Object.keys(existingOpts).length === 0) {
        existingOpts['A'] = '';
        existingOpts['B'] = '';
        existingOpts['C'] = '';
        existingOpts['D'] = '';
      }
    }

    setEditFormData({
      id: q.id,
      question: q.question,
      type: q.type,
      options: existingOpts,
      answer: q.answer,
      analysis: q.analysis || '',
      chapter: q.chapter,
      tags: q.tags ? [...q.tags] : []
    });
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingQuestionId(null);
    setEditFormData(null);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editFormData) return;
    if (!editFormData.question.trim()) {
      alert('题干内容不能为空');
      return;
    }

    const originalQuestion = questions.find((q) => q.id === editFormData.id);
    const updatedQuestion: Question = {
      ...(originalQuestion || {}),
      id: editFormData.id,
      type: editFormData.type,
      question: editFormData.question.trim(),
      options: Object.keys(editFormData.options).length > 0 ? editFormData.options : undefined,
      answer: editFormData.answer,
      analysis: editFormData.analysis.trim() || undefined,
      chapter: editFormData.chapter,
      tags: editFormData.tags
    };

    if (onUpdateQuestion) {
      await onUpdateQuestion(updatedQuestion);
      showFeedback(`已成功修改题目 #${editFormData.id}`);
    }

    setEditingQuestionId(null);
    setEditFormData(null);
  };

  // 选项答案切换（单选设为唯一，多选切换包含）
  const handleToggleOptionAnswer = (letter: string) => {
    if (!editFormData) return;
    if (editFormData.type === 'single') {
      setEditFormData({ ...editFormData, answer: letter });
    } else if (editFormData.type === 'multiple') {
      const currentAns = typeof editFormData.answer === 'string' ? editFormData.answer.toUpperCase().split('') : [];
      let nextLetters: string[];
      if (currentAns.includes(letter)) {
        nextLetters = currentAns.filter((l) => l !== letter);
      } else {
        nextLetters = [...currentAns, letter].sort();
      }
      setEditFormData({ ...editFormData, answer: nextLetters.join('') });
    }
  };

  const handleOptionTextChange = (letter: string, text: string) => {
    if (!editFormData) return;
    setEditFormData({
      ...editFormData,
      options: {
        ...editFormData.options,
        [letter]: text
      }
    });
  };

  const hasActiveFilter = filterChapter !== 'all' || filterTag !== 'all' || filterStatus !== 'all' || filterType !== 'all' || !!searchKeyword.trim();

  return (
    <div className="space-y-3 animate-in fade-in duration-200 pb-16">
      {/* 顶部整合式导航与全新三段式筛选栏 (吸顶固定) */}
      <div className="sticky top-0 z-40 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 bg-[#f2f5f7]/95 backdrop-blur-md border-b border-[#dfe3e8]/80 space-y-2">
        {/* 第一行：题库标题返回与速记/刷题行动按钮 */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
            <button
              onClick={onBack}
              className="p-1 sm:p-1.5 text-[#838b96] hover:text-[#303336] hover:bg-stone-200/60 rounded-lg transition-colors shrink-0 cursor-pointer"
              title="返回题库列表"
            >
              <ArrowLeft className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>
            <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
              <h2 className="text-[16px] sm:text-[18px] font-bold text-[#303336] tracking-tight truncate max-w-[130px] sm:max-w-xs md:max-w-md">
                {bankName}
              </h2>
              <span className="text-[11px] sm:text-[12px] bg-[#e4e8ec] text-[#55606e] px-2 py-0.5 rounded-full font-medium shrink-0">
                {questions.length} 题
              </span>
              {wrongCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus(filterStatus === 'wrong' ? 'all' : 'wrong')}
                  className={`text-[11px] sm:text-[12px] px-2 py-0.5 rounded-full font-medium items-center space-x-1 shrink-0 inline-flex transition-colors cursor-pointer ${
                    filterStatus === 'wrong'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-rose-50 border border-rose-200/80 text-rose-700 hover:bg-rose-100'
                  }`}
                  title="点击切换错题过滤"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>错题 {wrongCount}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              onClick={() => onStartPractice('study')}
              className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs sm:text-[13px] font-medium px-2.5 sm:px-3.5 h-8 sm:h-8.5 rounded-lg transition-colors flex items-center space-x-1 sm:space-x-1.5 shadow-2xs active:scale-[0.98] cursor-pointer"
              title="速记 (闪卡)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>速记</span>
            </button>
            <button
              onClick={() => onStartPractice('test')}
              className="bg-[#059669] hover:bg-[#047857] text-white text-xs sm:text-[13px] font-medium px-2.5 sm:px-3.5 h-8 sm:h-8.5 rounded-lg transition-colors flex items-center space-x-1 sm:space-x-1.5 shadow-2xs active:scale-[0.98] cursor-pointer"
              title="刷题 (做题)"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>刷题</span>
            </button>
          </div>
        </div>

        {/* 移动端：单行固定收敛工具栏 (彻底放弃横向滑轨，严禁纵向堆叠多行) */}
        <div className="md:hidden h-11 px-3 bg-white border border-[#dfe3e8] rounded-xl shadow-xs flex items-center gap-2">
          {/* 搜索框：轻量占位，自适应填补左侧 */}
          <div className="flex-1 h-8 bg-[#f2f5f7] rounded-lg px-2.5 flex items-center gap-1.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#2576eb] border border-transparent focus-within:border-[#dfe3e8] transition-all">
            <Search className="w-3.5 h-3.5 text-[#838b96] shrink-0" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索题目..."
              className="w-full h-full text-xs bg-transparent text-[#303336] placeholder-[#838b96] border-0 focus:outline-none"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="text-xs text-[#838b96] hover:text-[#303336] cursor-pointer font-bold leading-none p-0.5"
                title="清空搜索"
              >
                ✕
              </button>
            )}
          </div>

          {/* 题型直选：使用原生 <select> 伪装为 Things 风格浅灰胶囊 */}
          <div className="relative shrink-0">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="h-8 pl-2.5 pr-6 text-xs bg-[#f2f5f7] text-[#303336] rounded-lg border-0 appearance-none font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#2576eb]"
            >
              <option value="all">题型 ({questions.length})</option>
              {dynamicTypeStats.single > 0 && <option value="single">单选 ({dynamicTypeStats.single})</option>}
              {dynamicTypeStats.multiple > 0 && <option value="multiple">多选 ({dynamicTypeStats.multiple})</option>}
              {dynamicTypeStats.judge > 0 && <option value="judge">判断 ({dynamicTypeStats.judge})</option>}
              {dynamicTypeStats.definition > 0 && <option value="definition">名词 ({dynamicTypeStats.definition})</option>}
              {dynamicTypeStats.blank > 0 && <option value="blank">填空 ({dynamicTypeStats.blank})</option>}
              {dynamicTypeStats.essay > 0 && <option value="essay">论述 ({dynamicTypeStats.essay})</option>}
            </select>
            <ChevronDown className="w-3 h-3 text-[#838b96] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 组合过滤键：右侧放置一个 [状态/章节 ▾] 胶囊按钮 */}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className={`h-8 px-2.5 text-xs rounded-lg border-0 shrink-0 font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              filterStatus !== 'all' || filterChapter !== 'all' || filterTag !== 'all'
                ? 'bg-blue-50 text-[#2576eb]'
                : 'bg-[#f2f5f7] text-[#303336] hover:bg-[#e8edf2]'
            }`}
            title="打开状态与章节过滤抽屉"
          >
            <span>
              {filterStatus === 'wrong'
                ? '错题'
                : filterStatus === 'mastered'
                ? '已掌握'
                : filterStatus === 'unpracticed'
                ? '未练'
                : filterChapter !== 'all'
                ? '章节'
                : '状态/章节'}
            </span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>
        </div>

        {/* 桌面端：全新三段式筛选栏容器 (Toolbar Blocks) */}
        <div className="hidden md:flex bg-white rounded-xl border border-[#dfe3e8] p-1.5 sm:p-2 shadow-sm flex-wrap items-center gap-2">
          {/* 组块 1：微型伸缩搜索框 (平滑展开宽度 220px，失焦无内容平滑缩回 32px) */}
          <div
            className={`relative flex items-center transition-all duration-300 h-8 rounded-lg overflow-hidden shrink-0 ${
              isSearchOpen || searchKeyword
                ? 'w-48 sm:w-56 bg-white border border-[#dfe3e8] shadow-2xs'
                : 'w-8 bg-[#f2f5f7] hover:bg-[#e8edf2]'
            }`}
          >
            <button
              type="button"
              onClick={handleOpenSearch}
              className="w-8 h-8 flex items-center justify-center text-[#838b96] hover:text-[#303336] shrink-0 cursor-pointer"
              title="点击搜索题目"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            {(isSearchOpen || searchKeyword) && (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onBlur={handleSearchBlur}
                  placeholder="搜索题号、题干..."
                  className="w-full h-full pr-7 text-xs bg-transparent text-[#303336] placeholder-[#838b96] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSearchClose}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#838b96] hover:text-[#303336] cursor-pointer font-bold leading-none p-0.5"
                  title="清空并收起"
                >
                  ✕
                </button>
              </>
            )}
          </div>

          {/* 组块 2：题型分段控制器 (Things 风格灰色滑动底槽 + 纯白微浮块高亮) */}
          <div className="bg-[#f2f5f7] p-1 rounded-lg flex gap-1 items-center shrink-0 overflow-x-auto slim-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-white text-[#303336] shadow-sm font-medium'
                  : 'text-[#838b96] hover:text-[#303336]'
              }`}
            >
              全部({dynamicTypeStats.total})
            </button>
            {dynamicTypeStats.single > 0 && (
              <button
                type="button"
                onClick={() => setFilterType(filterType === 'single' ? 'all' : 'single')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'single'
                    ? 'bg-white text-blue-700 shadow-sm font-medium'
                    : 'text-[#838b96] hover:text-[#303336]'
                }`}
              >
                单选({dynamicTypeStats.single})
              </button>
            )}
            {dynamicTypeStats.multiple > 0 && (
              <button
                type="button"
                onClick={() => setFilterType(filterType === 'multiple' ? 'all' : 'multiple')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'multiple'
                    ? 'bg-white text-purple-700 shadow-sm font-medium'
                    : 'text-[#838b96] hover:text-[#303336]'
                }`}
              >
                多选({dynamicTypeStats.multiple})
              </button>
            )}
            {dynamicTypeStats.judge > 0 && (
              <button
                type="button"
                onClick={() => setFilterType(filterType === 'judge' ? 'all' : 'judge')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'judge'
                    ? 'bg-white text-amber-700 shadow-sm font-medium'
                    : 'text-[#838b96] hover:text-[#303336]'
                }`}
              >
                判断({dynamicTypeStats.judge})
              </button>
            )}
            {dynamicTypeStats.definition > 0 && (
              <button
                type="button"
                onClick={() => setFilterType(filterType === 'definition' ? 'all' : 'definition')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'definition'
                    ? 'bg-white text-emerald-700 shadow-sm font-medium'
                    : 'text-[#838b96] hover:text-[#303336]'
                }`}
              >
                名词({dynamicTypeStats.definition})
              </button>
            )}
            {dynamicTypeStats.blank > 0 && (
              <button
                type="button"
                onClick={() => setFilterType(filterType === 'blank' ? 'all' : 'blank')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'blank'
                    ? 'bg-white text-teal-700 shadow-sm font-medium'
                    : 'text-[#838b96] hover:text-[#303336]'
                }`}
              >
                填空({dynamicTypeStats.blank})
              </button>
            )}
            {dynamicTypeStats.essay > 0 && (
              <button
                type="button"
                onClick={() => setFilterType(filterType === 'essay' ? 'all' : 'essay')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'essay'
                    ? 'bg-white text-rose-700 shadow-sm font-medium'
                    : 'text-[#838b96] hover:text-[#303336]'
                }`}
              >
                论述({dynamicTypeStats.essay})
              </button>
            )}
          </div>

          {/* 组块 3：状态极简过滤 ([⚪ 全部] [🟢 7] [🔴 1]) */}
          <div className="bg-[#f2f5f7] p-1 rounded-lg flex items-center gap-1 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`h-7 px-2 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                filterStatus === 'all'
                  ? 'bg-white text-[#303336] shadow-sm font-medium'
                  : 'text-[#838b96] hover:text-[#303336]'
              }`}
              title="查看全部状态题目"
            >
              <span className="w-2 h-2 rounded-full bg-stone-300 shrink-0" />
              <span>全部</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'mastered' ? 'all' : 'mastered')}
              className={`h-7 px-2 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                filterStatus === 'mastered'
                  ? 'bg-white text-emerald-800 shadow-sm font-medium'
                  : 'text-[#838b96] hover:text-[#303336]'
              }`}
              title="按已掌握过滤"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-mono">{masteredCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'wrong' ? 'all' : 'wrong')}
              className={`h-7 px-2 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                filterStatus === 'wrong'
                  ? 'bg-white text-rose-800 shadow-sm font-medium'
                  : 'text-[#838b96] hover:text-[#303336]'
              }`}
              title="按错题过滤"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="font-mono">{wrongCount}</span>
            </button>

            {unpracticedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'unpracticed' ? 'all' : 'unpracticed')}
                className={`h-7 px-2 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  filterStatus === 'unpracticed'
                    ? 'bg-white text-[#303336] shadow-sm font-medium'
                    : 'text-[#838b96] hover:text-[#303336]'
                }`}
                title="按未练习过滤"
              >
                <span className="w-2 h-2 rounded-full bg-[#9aa3af] shrink-0" />
                <span className="font-mono">{unpracticedCount}</span>
              </button>
            )}
          </div>

          {/* 辅助章节与考点下拉 */}
          {chaptersList.length > 0 && (
            <div className="relative shrink-0">
              <select
                value={filterChapter}
                onChange={(e) => setFilterChapter(e.target.value)}
                className={`h-8 appearance-none pl-2 pr-5 rounded-lg text-xs border cursor-pointer focus:outline-none focus:border-[#2576eb] transition-colors ${
                  filterChapter !== 'all'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-800 font-medium'
                    : 'bg-[#f8fafc] border-[#dfe3e8] text-[#55606e] hover:border-[#b8c2cc]'
                }`}
              >
                <option value="all">全章节</option>
                {chaptersList.map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[#838b96] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {tagsList.length > 0 && (
            <div className="relative shrink-0">
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className={`h-8 appearance-none pl-2 pr-5 rounded-lg text-xs border cursor-pointer focus:outline-none focus:border-[#2576eb] transition-colors ${
                  filterTag !== 'all'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-800 font-medium'
                    : 'bg-[#f8fafc] border-[#dfe3e8] text-[#55606e] hover:border-[#b8c2cc]'
                }`}
              >
                <option value="all">全考点</option>
                {tagsList.map(([tag, count]) => (
                  <option key={tag} value={tag}>#{tag} ({count})</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[#838b96] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setFilterChapter('all');
                setFilterTag('all');
                setFilterStatus('all');
                setFilterType('all');
                setSearchKeyword('');
                setIsSearchOpen(false);
              }}
              className="text-xs text-[#838b96] hover:text-[#303336] underline cursor-pointer shrink-0 ml-1 flex items-center space-x-1"
              title="清除所有筛选"
            >
              <RotateCcw className="w-3 h-3" />
              <span>重置</span>
            </button>
          )}

          {/* 右侧尾部：极简灰字计数 "10 / 30 题" */}
          <div className="text-xs text-[#838b96] font-mono shrink-0 ml-auto select-none pl-2">
            <strong className="text-[#303336] font-semibold">{filteredQuestions.length}</strong> / {questions.length} 题
          </div>
        </div>
      </div>

      {/* 操作提示 Toast */}
      {actionSuccessMsg && (
        <div className="bg-[#303336] text-white text-xs px-3.5 py-1.5 rounded-lg shadow-lg flex items-center justify-between animate-in fade-in duration-150">
          <span>{actionSuccessMsg}</span>
          <button 
            type="button"
            onClick={() => setActionSuccessMsg(null)} 
            className="text-[#838b96] hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 题目列表卡片 */}
      {filteredQuestions.length === 0 ? (
        <div className="things-card p-12 bg-white rounded-xl border border-[#dfe3e8] text-center text-[#838b96] mt-4">
          <BookOpen className="w-9 h-9 mx-auto text-[#838b96]/50 mb-2" />
          <p className="text-sm font-medium text-[#303336]">未找到匹配条件的题目</p>
          <p className="text-xs text-[#838b96] mt-1">请尝试清除搜索关键词或调整题型/状态/章节过滤</p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setFilterChapter('all');
                setFilterTag('all');
                setFilterStatus('all');
                setFilterType('all');
                setSearchKeyword('');
                setIsSearchOpen(false);
              }}
              className="mt-3 text-xs text-[#2576eb] hover:underline font-medium cursor-pointer inline-flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>恢复全部题目</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 pt-1">
          {filteredQuestions.map((q) => {
            const isEditing = editingQuestionId === q.id;
            const isExpanded = expandedIds.has(q.id);
            const typeBadge = getTypeBadge(q.type);
            const qStatus = getQuestionStatus(q.id);
            const wrongRecord = wrongBook[q.id];
            const hasOpts = q.options && Object.keys(q.options).length > 0;
            const ansLetters = typeof q.answer === 'string' ? q.answer.toUpperCase().split('') : [];
            const cleanAnswer = getDirectCleanAnswer(q);
            const questionKeywords = Array.from(
              new Set([
                ...(Array.isArray(q.tags) ? q.tags : []),
                ...(Array.isArray(q.keyPoints) ? q.keyPoints : []),
              ])
            ).filter((k) => Boolean(k && k.trim()));

            return (
              <div
                key={q.id}
                className={`things-card bg-white rounded-xl border transition-all duration-150 group overflow-hidden ${
                  isEditing ? 'border-[#2576eb] shadow-md ring-1 ring-[#2576eb]/20' : 'border-[#dfe3e8]'
                }`}
              >
                {/* 移动端：双行式高密度排版 (Two-line Deck Card) */}
                <div
                  onClick={() => toggleExpand(q.id)}
                  className={`md:hidden p-3 flex flex-col justify-between cursor-pointer select-none hover:bg-stone-50/60 transition-colors ${
                    isExpanded ? 'bg-stone-50/40' : ''
                  }`}
                >
                  {/* 第一行 (题干行：题号 + 加粗题干) */}
                  <div className="flex items-start gap-1.5">
                    <span className="font-mono text-[11px] font-semibold text-[#838b96] shrink-0 pt-0.5">
                      #{q.id}
                    </span>

                    <p className={`text-[13.5px] font-bold text-[#1e2329] leading-snug break-words flex-1 select-text ${
                      isExpanded ? 'whitespace-normal' : 'line-clamp-2'
                    }`}>
                      {q.question}
                    </p>

                    {/* 展开时右侧微箭头 */}
                    {isExpanded && (
                      <ChevronDown className="w-4 h-4 text-[#838b96] shrink-0 mt-0.5 ml-1" />
                    )}
                  </div>

                  {/* 题干下方：展开时显示知识点类型、章节标签与考点关键词 */}
                  {isExpanded && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] border shrink-0 leading-none ${typeBadge.bg}`}>
                        {typeBadge.label}
                      </span>
                      {q.chapter && (
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-1.5 py-0.5 rounded font-medium shrink-0">
                          {q.chapter}
                        </span>
                      )}
                      {questionKeywords.map((kw) => (
                        <span key={kw} className="text-[10px] text-indigo-700 bg-indigo-50/80 border border-indigo-200/60 px-1.5 py-0.5 rounded font-medium shrink-0">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 第二行 (答案与状态行 - 仅在折叠时显示) */}
                  {!isExpanded && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* 左侧答案标签 */}
                      <div className="flex items-center shrink-0 max-w-[200px] overflow-hidden">
                        {cleanAnswer.isJudge ? (
                          cleanAnswer.isTrue ? (
                            <span className="inline-flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded font-medium">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>正确</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-xs text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded font-medium">
                              <X className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>错误</span>
                            </span>
                          )
                        ) : cleanAnswer.text ? (
                          <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded font-medium border border-emerald-200/50 truncate max-w-[200px]" title={cleanAnswer.text}>
                            {cleanAnswer.text}
                          </span>
                        ) : null}
                      </div>

                      {/* 右侧状态交互 */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {/* 状态圆点 */}
                        {qStatus === 'wrong' ? (
                          <button
                            type="button"
                            onClick={(e) => handleDotClick(e, q.id, 'wrong')}
                            className="h-6 px-2 rounded-full flex items-center space-x-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                            title={`错题 (${wrongRecord?.count || 1}次，点击移出错题)`}
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span className="text-[11px] font-mono text-rose-700 font-semibold">{wrongRecord?.count || 1}次</span>
                          </button>
                        ) : qStatus === 'mastered' ? (
                          <button
                            type="button"
                            onClick={(e) => handleDotClick(e, q.id, 'mastered')}
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                            title="已掌握 (点击重置为未练习)"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleDotClick(e, q.id, 'unpracticed')}
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-[#f2f5f7] hover:bg-stone-200/70 border border-[#dfe3e8] transition-colors cursor-pointer"
                            title="未练习 (点击标记为已掌握)"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#9aa3af] shrink-0" />
                          </button>
                        )}

                        {/* 折叠微箭头 */}
                        <div className="text-[#838b96]">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 桌面端：单行紧凑通栏 (Summary Row) */}
                <div
                  onClick={() => toggleExpand(q.id)}
                  className={`hidden md:flex px-4 py-3 justify-between gap-3 cursor-pointer hover:bg-stone-50/60 transition-colors select-none ${
                    isExpanded ? 'items-start bg-stone-50/40' : 'items-center'
                  }`}
                >
                  {/* 左侧：题号与加粗题干，下方为知识点类型、章节标签与关键词 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-xs font-semibold text-[#838b96] shrink-0 pt-0.5">
                        #{q.id}
                      </span>
                      <p className={`text-xs sm:text-[13.5px] font-bold text-[#1e2329] leading-snug break-words select-text ${
                        isExpanded ? 'whitespace-normal' : 'line-clamp-1 sm:line-clamp-2 pr-2'
                      }`}>
                        {q.question}
                      </p>
                    </div>

                    {/* 题干下方：展开时显示知识点类型和章节标签 */}
                    {isExpanded && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-6">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] border shrink-0 leading-none ${typeBadge.bg}`}>
                          {typeBadge.label}
                        </span>
                        {q.chapter && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-1.5 py-0.5 rounded font-medium">
                            {q.chapter}
                          </span>
                        )}
                        {questionKeywords.map((kw) => (
                          <span key={kw} className="text-[10px] text-indigo-700 bg-indigo-50/80 border border-indigo-200/60 px-1.5 py-0.5 rounded font-medium">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 中间：纯文本正确答案标签 - 仅在折叠时显示 */}
                  {!isExpanded && (
                    <div className="flex items-center shrink-0 max-w-[280px]">
                      {cleanAnswer.isJudge ? (
                        cleanAnswer.isTrue ? (
                          <span 
                            className="inline-flex items-center justify-center w-6 h-6 text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-md"
                            title="判断：正确"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center justify-center w-6 h-6 text-rose-700 bg-rose-50 border border-rose-200/80 rounded-md"
                            title="判断：错误"
                          >
                            <X className="w-3.5 h-3.5 stroke-[3] text-rose-600" />
                          </span>
                        )
                      ) : cleanAnswer.text ? (
                        <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md font-medium truncate max-w-[260px]">
                          {cleanAnswer.text}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* 右侧操作槽：折叠时显示状态圆点 + 展开/收起箭头 */}
                  <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                    {!isExpanded && (
                      qStatus === 'wrong' ? (
                        <button
                          type="button"
                          onClick={(e) => handleDotClick(e, q.id, 'wrong')}
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-rose-50 hover:bg-rose-100 border border-rose-200/90 transition-colors cursor-pointer"
                          title={`错题 (${wrongRecord?.count || 1}次，点击从错题本移出并重置)`}
                        >
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                        </button>
                      ) : qStatus === 'mastered' ? (
                        <button
                          type="button"
                          onClick={(e) => handleDotClick(e, q.id, 'mastered')}
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 transition-colors cursor-pointer"
                          title="已掌握 (点击重置为未练习)"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDotClick(e, q.id, 'unpracticed')}
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-[#f2f5f7] hover:bg-stone-200/70 border border-[#dfe3e8] transition-colors cursor-pointer"
                          title="未练习 (点击可快速标记为已掌握)"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#9aa3af] shrink-0" />
                        </button>
                      )
                    )}

                    {/* 右折叠微箭头 */}
                    <div className="text-[#838b96] p-0.5 ml-1">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 transition-transform text-[#303336]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 transition-transform" />
                      )}
                    </div>
                  </div>
                </div>

                {/* 原地编辑表单 (Inline Edit Form) */}
                {isEditing && editFormData ? (
                  <div 
                    className="px-3.5 sm:px-5 pb-4 pt-3 border-t border-[#dfe3e8]/70 bg-stone-50/40 space-y-3.5 animate-in fade-in duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 题干输入框 (textarea) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#55606e] mb-1.5">
                        题干内容
                      </label>
                      <textarea
                        value={editFormData.question}
                        onChange={(e) => setEditFormData({ ...editFormData, question: e.target.value })}
                        rows={2}
                        className="bg-[#f8fafc] border border-[#dfe3e8] rounded-lg p-2.5 text-sm w-full font-medium focus:outline-none focus:border-[#2576eb] transition-colors resize-y leading-relaxed text-[#303336]"
                        placeholder="请输入题干内容..."
                      />
                    </div>

                    {/* 选项配置（选择题 single / multiple）：纵向排列 A/B/C/D 输入框，左侧圆形按键一键切换正确答案 */}
                    {(editFormData.type === 'single' || editFormData.type === 'multiple') && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-[#55606e]">
                          <span className="font-semibold">
                            选项配置 (点击左侧圆形字母切换为正确答案)
                          </span>
                          <span className="text-[11px] text-[#838b96]">
                            当前正确答案: <strong className="text-emerald-700 font-bold">{String(editFormData.answer || '')}</strong>
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {['A', 'B', 'C', 'D', 'E', 'F']
                            .filter(
                              (letter) =>
                                editFormData.options[letter] !== undefined ||
                                (['A', 'B', 'C', 'D'].includes(letter) && Object.keys(editFormData.options).length <= 4)
                            )
                            .map((letter) => {
                              const currentAnsStr = typeof editFormData.answer === 'string' ? editFormData.answer.toUpperCase() : '';
                              const isSelected = currentAnsStr.includes(letter);
                              return (
                                <div
                                  key={letter}
                                  className={`flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                                    isSelected
                                      ? 'border-emerald-400 bg-emerald-50/40 shadow-2xs'
                                      : 'border-[#dfe3e8] bg-white'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleOptionAnswer(letter)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors cursor-pointer shrink-0 ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-[#f2f5f7] text-[#55606e] hover:bg-stone-200'
                                    }`}
                                    title={`点击将 ${letter} 设为正确选项`}
                                  >
                                    {letter}
                                  </button>
                                  <input
                                    type="text"
                                    value={editFormData.options[letter] || ''}
                                    onChange={(e) => handleOptionTextChange(letter, e.target.value)}
                                    placeholder={`选项 ${letter} 内容`}
                                    className="flex-1 text-xs bg-transparent text-[#303336] focus:outline-none"
                                  />
                                  {isSelected && (
                                    <div className="flex items-center text-emerald-600 pr-1 shrink-0" title="当前正确选项">
                                      <Check className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* 判断题选项切换 */}
                    {editFormData.type === 'judge' && (
                      <div>
                        <label className="block text-xs font-semibold text-[#55606e] mb-1.5">
                          正确判断 (点击直接切换)
                        </label>
                        <div className="flex items-center gap-3">
                          {(() => {
                            const raw = typeof editFormData.answer === 'string' ? editFormData.answer.trim().toUpperCase() : String(editFormData.answer);
                            const isTrue = raw === 'T' || raw === 'TRUE' || raw === '正确' || raw === '对' || raw === '1' || raw === '√';
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditFormData({ ...editFormData, answer: '正确' })}
                                  className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                                    isTrue
                                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-2xs'
                                      : 'bg-white border-[#dfe3e8] text-[#55606e] hover:bg-stone-50'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>正确 (√)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditFormData({ ...editFormData, answer: '错误' })}
                                  className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                                    !isTrue
                                      ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-2xs'
                                      : 'bg-white border-[#dfe3e8] text-[#55606e] hover:bg-stone-50'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>错误 (×)</span>
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* 非客观题（填空/名词解释/论述）参考答案 */}
                    {editFormData.type !== 'single' && editFormData.type !== 'multiple' && editFormData.type !== 'judge' && (
                      <div>
                        <label className="block text-xs font-semibold text-[#55606e] mb-1.5">
                          参考答案
                        </label>
                        <textarea
                          value={Array.isArray(editFormData.answer) ? editFormData.answer.join(' / ') : String(editFormData.answer || '')}
                          onChange={(e) => setEditFormData({ ...editFormData, answer: e.target.value })}
                          rows={2}
                          className="bg-[#f8fafc] border border-[#dfe3e8] rounded-lg p-2.5 text-xs w-full focus:outline-none focus:border-[#2576eb] transition-colors resize-y leading-relaxed text-[#303336]"
                          placeholder="输入参考答案..."
                        />
                      </div>
                    )}

                    {/* 解析输入框 */}
                    <div>
                      <label className="block text-xs font-semibold text-[#55606e] mb-1.5">
                        题目解析
                      </label>
                      <textarea
                        value={editFormData.analysis}
                        onChange={(e) => setEditFormData({ ...editFormData, analysis: e.target.value })}
                        rows={2}
                        className="bg-[#f8fafc] border border-[#dfe3e8] rounded-lg p-2.5 text-xs w-full focus:outline-none focus:border-[#2576eb] transition-colors resize-y leading-relaxed text-[#55606e]"
                        placeholder="输入解析内容..."
                      />
                    </div>

                    {/* 行底操作栏 */}
                    <div className="pt-2 border-t border-[#dfe3e8]/70">
                      {/* 移动端：满宽大圆角按钮，单手大拇指极佳操作 */}
                      <div className="md:hidden space-y-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="w-full py-2.5 rounded-xl bg-[#2576eb] hover:bg-[#1f65ca] active:scale-[0.99] text-white text-sm font-medium shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>保存修改</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="w-full py-2 rounded-xl text-xs text-[#55606e] hover:text-[#303336] bg-[#f2f5f7] hover:bg-stone-200/70 text-center font-medium cursor-pointer"
                        >
                          取消编辑
                        </button>
                      </div>

                      {/* 桌面端：右下角提供 [取消] 与 [保存修改] */}
                      <div className="hidden md:flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="bg-[#2576eb] hover:bg-[#1f65ca] text-white text-xs px-3.5 py-1.5 rounded-lg shadow-sm font-medium transition-colors cursor-pointer"
                        >
                          保存修改
                        </button>
                      </div>
                    </div>
                  </div>
                ) : isExpanded ? (
                  /* 详情展开区 (Expanded Details) - 题干与考点已在顶部行呈现，此处直接呈现答案、选项与解析 */
                  <div className="px-3.5 sm:px-5 pb-4 pt-3 border-t border-[#dfe3e8]/70 bg-stone-50/20 space-y-3 animate-in fade-in duration-150">
                    {/* 判断题展开：直观呈现正确/错误结论 */}
                    {q.type === 'judge' && (
                      <div className="flex items-center space-x-2 p-2.5 bg-white border border-[#dfe3e8] rounded-lg text-xs">
                        <span className="text-[#838b96] font-medium">标准判断:</span>
                        {cleanAnswer.isTrue ? (
                          <span className="text-emerald-700 font-bold flex items-center space-x-1">
                            <Check className="w-4 h-4 stroke-[2.5]" />
                            <span>正确 (√ / True)</span>
                          </span>
                        ) : (
                          <span className="text-rose-700 font-bold flex items-center space-x-1">
                            <X className="w-4 h-4 stroke-[2.5]" />
                            <span>错误 (× / False)</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* 客观题选项行 */}
                    {hasOpts && (
                      <div className="space-y-1.5">
                        {Object.entries(q.options!).map(([key, val]) => {
                          const isCorrect = ansLetters.includes(key.toUpperCase());
                          return (
                            <div
                              key={key}
                              className={`flex items-center space-x-2.5 px-3 min-h-[36px] rounded-lg border text-xs transition-colors ${
                                isCorrect
                                  ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950 font-medium'
                                  : 'bg-white border-[#dfe3e8] text-[#55606e]'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#f2f5f7] text-[#55606e]'
                                }`}
                              >
                                {key}
                              </span>
                              <span className="flex-1 leading-tight select-text">
                                {val}
                              </span>
                              {isCorrect && (
                                <span className="text-emerald-700 text-[11px] font-semibold flex items-center space-x-1 shrink-0">
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                  <span>正确选项</span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 主观题/填空题答案展示 */}
                    {!hasOpts && q.type !== 'judge' && q.answer && (
                      <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-lg text-xs leading-relaxed text-emerald-950 select-text">
                        <div className="text-[11px] font-bold text-emerald-800 mb-1">
                          参考答案
                        </div>
                        <p className="whitespace-pre-wrap font-sans">
                          {Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer}
                        </p>
                      </div>
                    )}

                    {/* 解析模块 */}
                    {q.analysis && (
                      <div className="bg-[#f8fafc] border border-[#dfe3e8] rounded-lg p-3 text-xs text-[#55606e] space-y-1">
                        <div className="font-bold text-[#303336] text-[11px]">
                          题目解析
                        </div>
                        <p className="leading-relaxed select-text whitespace-pre-wrap">
                          {q.analysis}
                        </p>
                      </div>
                    )}

                    {/* 底部修改与管理操作折叠栏 (极简紧凑，仅保留折叠箭头) */}
                    <div className="pt-1 border-t border-[#dfe3e8]/60">
                      {!expandedActionIds.has(q.id) ? (
                        <div className="flex items-center justify-end py-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActionBar(q.id);
                            }}
                            className="p-1 text-[#9aa2ad] hover:text-[#2576eb] hover:bg-blue-50/60 rounded transition-colors flex items-center justify-center cursor-pointer"
                            title="展开题目操作"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-0.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleActionBar(q.id);
                              }}
                              className="p-1 text-[#9aa2ad] hover:text-[#303336] hover:bg-stone-100 rounded transition-colors flex items-center justify-center cursor-pointer"
                              title="收起题目操作"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* 移动端展开底部操作行：3个操作按钮 (重置/移出、移除、修改，均精简为2个字) */}
                          <div className="md:hidden">
                            {confirmDeleteQuestionId === q.id ? (
                              <div 
                                className="flex items-center justify-between bg-rose-50 border border-rose-200 p-2.5 rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-xs text-rose-700 font-medium">确认永久移除？</span>
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await onDeleteQuestion?.(q.id);
                                      setConfirmDeleteQuestionId(null);
                                      showFeedback(`已删除题目 #${q.id}`);
                                    }}
                                    className="bg-rose-600 text-white text-xs px-2.5 py-1 rounded font-medium cursor-pointer"
                                  >
                                    确认
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteQuestionId(null);
                                    }}
                                    className="bg-stone-200 text-[#55606e] text-xs px-2 py-1 rounded cursor-pointer"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-2">
                                {/* 按钮 1: 重置 / 移出错题 */}
                                {qStatus === 'wrong' ? (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await onRemoveFromWrongBook?.(q.id);
                                      showFeedback(`已将 #${q.id} 移出错题本`);
                                    }}
                                    className="py-2 px-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium flex items-center justify-center space-x-1 cursor-pointer hover:bg-emerald-100 transition-colors"
                                    title="移出错题本"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>移出</span>
                                  </button>
                                ) : qStatus === 'mastered' ? (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await onToggleMastered?.(q.id, false);
                                      showFeedback(`已将 #${q.id} 重置为未练习`);
                                    }}
                                    className="py-2 px-1 rounded-lg bg-stone-50 text-[#55606e] hover:text-[#303336] border border-[#dfe3e8] text-xs font-medium flex items-center justify-center space-x-1 cursor-pointer hover:bg-stone-100 transition-colors"
                                    title="重置为未练习"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>重置</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await onToggleMastered?.(q.id, true);
                                      showFeedback(`已将 #${q.id} 标记为已掌握`);
                                    }}
                                    className="py-2 px-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium flex items-center justify-center space-x-1 cursor-pointer hover:bg-emerald-100 transition-colors"
                                    title="标记已掌握"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>掌握</span>
                                  </button>
                                )}

                                {/* 按钮 2: 移除题目 */}
                                {onDeleteQuestion && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteQuestionId(q.id);
                                    }}
                                    className="py-2 px-1 rounded-lg bg-[#f2f5f7] hover:bg-rose-50 text-[#838b96] hover:text-rose-600 border border-[#dfe3e8] hover:border-rose-200 text-xs font-medium flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                                    title="从题库中移除本题"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>移除</span>
                                  </button>
                                )}

                                {/* 按钮 3: 修改 */}
                                <button
                                  type="button"
                                  onClick={(e) => handleStartEdit(e, q)}
                                  className="py-2 px-1 rounded-lg bg-blue-50 text-[#2576eb] border border-blue-200 hover:bg-blue-100 text-xs font-medium flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                                  title="修改题目"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>修改</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 桌面端展开底部操作栏：3个按钮 (移除，重置/移出，修改，均精简为2个字) */}
                          <div className="hidden md:flex flex-wrap items-center justify-between gap-2 text-xs">
                            {/* 按钮 2: 移除（带确认二次保护） */}
                            <div className="flex items-center">
                              {onDeleteQuestion && (
                                confirmDeleteQuestionId === q.id ? (
                                  <div 
                                    className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-[11px] text-rose-700 font-medium">确认永久移除？</span>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await onDeleteQuestion(q.id);
                                        setConfirmDeleteQuestionId(null);
                                        showFeedback(`已从题库移除 #${q.id}`);
                                      }}
                                      className="text-white bg-rose-600 hover:bg-rose-700 text-[11px] px-2 py-0.5 rounded cursor-pointer font-medium"
                                    >
                                      确认
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteQuestionId(null);
                                      }}
                                      className="text-[#55606e] bg-stone-200 hover:bg-stone-300 text-[11px] px-1.5 py-0.5 rounded cursor-pointer"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteQuestionId(q.id);
                                    }}
                                    className="text-xs text-[#838b96] hover:text-rose-600 px-2.5 py-1 rounded-md hover:bg-rose-50 border border-transparent hover:border-rose-200/60 transition-colors cursor-pointer flex items-center space-x-1.5"
                                    title="从题库中移除此题"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>移除</span>
                                  </button>
                                )
                              )}
                            </div>

                            {/* 右侧：状态快捷流转与修改 */}
                            <div className="flex items-center space-x-1.5 ml-auto">
                              {/* 按钮 1: 重置/移出错题 */}
                              {qStatus === 'wrong' ? (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await onRemoveFromWrongBook?.(q.id);
                                    showFeedback(`已将 #${q.id} 移出错题本`);
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-white border border-[#dfe3e8] hover:border-emerald-300 hover:bg-emerald-50 text-emerald-700 font-medium transition-colors cursor-pointer flex items-center space-x-1 text-xs"
                                  title="从错题本移出"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>移出</span>
                                </button>
                              ) : qStatus === 'mastered' ? (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await onToggleMastered?.(q.id, false);
                                    showFeedback(`已将 #${q.id} 重置为未练习`);
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-white border border-[#dfe3e8] hover:border-stone-300 text-[#55606e] hover:text-[#303336] transition-colors cursor-pointer text-xs flex items-center space-x-1"
                                  title="重置为未练习"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-[#838b96]" />
                                  <span>重置</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await onToggleMastered?.(q.id, true);
                                    showFeedback(`已将 #${q.id} 标记为已掌握`);
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-white border border-[#dfe3e8] hover:border-emerald-300 hover:bg-emerald-50 text-emerald-700 font-medium transition-colors cursor-pointer flex items-center space-x-1 text-xs"
                                  title="标记已掌握"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>掌握</span>
                                </button>
                              )}

                              {/* 按钮 3: 修改 */}
                              <button
                                type="button"
                                onClick={(e) => handleStartEdit(e, q)}
                                className="px-3 py-1 rounded-md bg-white border border-[#dfe3e8] hover:border-blue-400 hover:bg-blue-50/80 text-[#2576eb] font-medium transition-colors cursor-pointer flex items-center space-x-1.5 text-xs shadow-2xs"
                                title="修改题目"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>修改</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* 移动端轻量筛选抽屉 (Bottom Sheet) */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden animate-in fade-in duration-200">
          {/* 半透明遮罩 */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity cursor-pointer"
            onClick={() => setIsFilterSheetOpen(false)}
          />

          {/* 抽屉内容主体 */}
          <div 
            className="relative w-full max-w-md bg-white rounded-t-2xl shadow-2xl p-4 pb-6 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶部手柄条 */}
            <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between pt-1 border-b border-[#dfe3e8]/70 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#303336]">状态与章节过滤</h3>
                <p className="text-[11px] text-[#838b96]">已匹配 {filteredQuestions.length} / {questions.length} 题</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="w-7 h-7 rounded-full bg-[#f2f5f7] text-[#838b96] hover:text-[#303336] flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 做题状态 */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#55606e]">练习状态</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`p-2.5 rounded-lg border flex items-center space-x-2 cursor-pointer transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-blue-50 border-[#2576eb] text-[#2576eb] font-semibold'
                      : 'bg-white border-[#dfe3e8] text-[#55606e]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-300 shrink-0" />
                  <span>全部状态 ({questions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('mastered')}
                  className={`p-2.5 rounded-lg border flex items-center space-x-2 cursor-pointer transition-colors ${
                    filterStatus === 'mastered'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold'
                      : 'bg-white border-[#dfe3e8] text-[#55606e]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>已掌握 ({masteredCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('wrong')}
                  className={`p-2.5 rounded-lg border flex items-center space-x-2 cursor-pointer transition-colors ${
                    filterStatus === 'wrong'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 font-semibold'
                      : 'bg-white border-[#dfe3e8] text-[#55606e]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span>错题 ({wrongCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('unpracticed')}
                  className={`p-2.5 rounded-lg border flex items-center space-x-2 cursor-pointer transition-colors ${
                    filterStatus === 'unpracticed'
                      ? 'bg-stone-100 border-stone-400 text-stone-800 font-semibold'
                      : 'bg-white border-[#dfe3e8] text-[#55606e]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-400 shrink-0" />
                  <span>未练习 ({unpracticedCount})</span>
                </button>
              </div>
            </div>

            {/* 章节过滤 */}
            {chaptersList.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#55606e]">所属章节</label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterChapter('all')}
                    className={`px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                      filterChapter === 'all'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                        : 'bg-[#f8fafc] border-[#dfe3e8] text-[#55606e]'
                    }`}
                  >
                    全部章节
                  </button>
                  {chaptersList.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setFilterChapter(ch === filterChapter ? 'all' : ch)}
                      className={`px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors truncate max-w-[200px] ${
                        filterChapter === ch
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                          : 'bg-[#f8fafc] border-[#dfe3e8] text-[#55606e]'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 考点标签过滤 */}
            {tagsList.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#55606e]">考点标签</label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterTag('all')}
                    className={`px-2 py-1 rounded-md border cursor-pointer text-[11px] ${
                      filterTag === 'all'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                        : 'bg-[#f8fafc] border-[#dfe3e8] text-[#55606e]'
                    }`}
                  >
                    全考点
                  </button>
                  {tagsList.map(([tag, count]) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFilterTag(tag === filterTag ? 'all' : tag)}
                      className={`px-2 py-1 rounded-md border cursor-pointer text-[11px] ${
                        filterTag === tag
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                          : 'bg-[#f8fafc] border-[#dfe3e8] text-[#55606e]'
                      }`}
                    >
                      #{tag} ({count})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 底部按钮 */}
            <div className="pt-2 border-t border-[#dfe3e8] flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('all');
                  setFilterChapter('all');
                  setFilterTag('all');
                }}
                className="w-1/3 py-2.5 text-xs text-[#838b96] hover:text-[#303336] bg-[#f2f5f7] rounded-xl font-medium cursor-pointer"
              >
                重置过滤
              </button>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 py-2.5 text-xs text-white bg-[#2576eb] hover:bg-[#1f65ca] rounded-xl font-medium cursor-pointer shadow-sm text-center"
              >
                完成 (显示 {filteredQuestions.length} 题)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
