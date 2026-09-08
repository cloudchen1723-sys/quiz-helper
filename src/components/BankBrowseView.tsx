import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  Flame, 
  BookOpen, 
  Check, 
  X,
  Play, 
  ChevronDown,
  Trash2,
  Clock,
  FolderOpen,
  Tag
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
}

export const BankBrowseView: React.FC<BankBrowseViewProps> = ({
  bankName,
  questions,
  wrongBook,
  masteredIds = [],
  stats,
  onBack,
  onStartPractice,
  onRemoveFromWrongBook,
  onToggleMastered,
  onDeleteQuestion
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<'all' | QuestionType>('all');
  const [filterChapter, setFilterChapter] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpracticed' | 'mastered' | 'wrong'>('all');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteQuestionId, setConfirmDeleteQuestionId] = useState<number | null>(null);

  const showFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 2500);
  };

  const masteredSet = useMemo(() => new Set(masteredIds), [masteredIds]);

  // 判断单道题目的状态：仅错题(wrong) > 已掌握(mastered) > 未练习(unpracticed)
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

  // 标签列表
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

  // 状态数量统计
  const wrongCount = useMemo(() => {
    return questions.filter((q) => !!wrongBook[q.id]).length;
  }, [questions, wrongBook]);

  const masteredCount = useMemo(() => {
    return questions.filter((q) => !wrongBook[q.id] && masteredSet.has(q.id)).length;
  }, [questions, wrongBook, masteredSet]);

  const unpracticedCount = Math.max(0, questions.length - wrongCount - masteredCount);

  // 过滤题目
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 搜索关键字（题干、选项、解析、采分点）
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

      // 标签过滤
      if (filterTag !== 'all') {
        if (!Array.isArray(q.tags) || !q.tags.includes(filterTag)) return false;
      }

      // 状态过滤 (未练习 / 已掌握 / 仅错题)
      const status = getQuestionStatus(q.id);
      if (filterStatus === 'wrong' && status !== 'wrong') return false;
      if (filterStatus === 'mastered' && status !== 'mastered') return false;
      if (filterStatus === 'unpracticed' && status !== 'unpracticed') return false;

      return true;
    });
  }, [questions, wrongBook, masteredSet, searchKeyword, filterType, filterChapter, filterTag, filterStatus]);

  const getTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'single':
        return { label: '单选', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'multiple':
        return { label: '多选', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'judge':
        return { label: '判断', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'blank':
        return { label: '填空', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'definition':
        return { label: '名词解释', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'essay':
        return { label: '论述简答', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: '题目', bg: 'bg-stone-100 text-stone-700 border-stone-200' };
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-16">
      {/* 搜索与多维过滤工具条 */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* 搜索框 */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索题号、题干、采分词、考点或解析..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-stone-900 transition-colors"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
              >
                清空
              </button>
            )}
          </div>

          {/* 题型快速切换 */}
          <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs shrink-0 self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterType === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              全部 ({stats.total})
            </button>
            {stats.single > 0 && (
              <button
                onClick={() => setFilterType('single')}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'single' ? 'bg-white text-blue-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                单选 ({stats.single})
              </button>
            )}
            {stats.multiple > 0 && (
              <button
                onClick={() => setFilterType('multiple')}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'multiple' ? 'bg-white text-purple-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                多选 ({stats.multiple})
              </button>
            )}
            {stats.judge > 0 && (
              <button
                onClick={() => setFilterType('judge')}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'judge' ? 'bg-white text-amber-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                判断 ({stats.judge})
              </button>
            )}
            {(stats.definition || 0) > 0 && (
              <button
                onClick={() => setFilterType('definition')}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'definition' ? 'bg-white text-emerald-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                名词 ({stats.definition})
              </button>
            )}
            {(stats.blank || 0) > 0 && (
              <button
                onClick={() => setFilterType('blank')}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'blank' ? 'bg-white text-teal-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                填空 ({stats.blank})
              </button>
            )}
            {(stats.essay || 0) > 0 && (
              <button
                onClick={() => setFilterType('essay')}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'essay' ? 'bg-white text-rose-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                论述 ({stats.essay})
              </button>
            )}
          </div>
        </div>

        {/* 章节与标签高级筛选栏 */}
        {(chaptersList.length > 0 || tagsList.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-xs">
            {chaptersList.length > 0 && (
              <div className="flex items-center space-x-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-stone-400">章节:</span>
                <select
                  value={filterChapter}
                  onChange={(e) => setFilterChapter(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-700 focus:outline-none focus:border-stone-900"
                >
                  <option value="all">全部章节 ({chaptersList.length})</option>
                  {chaptersList.map((ch) => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </div>
            )}

            {tagsList.length > 0 && (
              <div className="flex items-center space-x-1.5 ml-2">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-stone-400">考点:</span>
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-700 focus:outline-none focus:border-stone-900"
                >
                  <option value="all">全部知识点 ({tagsList.length})</option>
                  {tagsList.map(([tag, count]) => (
                    <option key={tag} value={tag}>#{tag} ({count})</option>
                  ))}
                </select>
              </div>
            )}

            {(filterChapter !== 'all' || filterTag !== 'all') && (
              <button
                onClick={() => {
                  setFilterChapter('all');
                  setFilterTag('all');
                }}
                className="text-[11px] text-stone-400 hover:text-stone-700 ml-auto"
              >
                重置分类筛选
              </button>
            )}
          </div>
        )}

        {/* 状态筛选工具栏 (未练习 / 已掌握 / 仅错题) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-stone-400 mr-1">做题状态:</span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                filterStatus === 'all' 
                  ? 'bg-stone-900 text-white border-stone-900' 
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterStatus('unpracticed')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1 ${
                filterStatus === 'unpracticed' 
                  ? 'bg-stone-700 text-white border-stone-700' 
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Clock className="w-3 h-3 text-stone-400" />
              <span>未练习 ({unpracticedCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus('mastered')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1 ${
                filterStatus === 'mastered' 
                  ? 'bg-emerald-600 text-white border-emerald-600' 
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>已掌握 ({masteredCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus('wrong')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1 ${
                filterStatus === 'wrong' 
                  ? 'bg-rose-600 text-white border-rose-600' 
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Flame className="w-3 h-3 text-rose-400" />
              <span>仅错题 ({wrongCount})</span>
            </button>
          </div>

          <div className="text-stone-400 font-mono text-[11px]">
            筛选显示 <strong className="text-stone-800 font-bold">{filteredQuestions.length}</strong> / {questions.length} 题
          </div>
        </div>
      </div>

      {/* 操作提示 Toast */}
      {actionSuccessMsg && (
        <div className="bg-stone-900 text-white text-xs px-4 py-2 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-150">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="text-stone-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 题目列表卡片流 */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-400">
          <BookOpen className="w-10 h-10 mx-auto text-stone-300 mb-2" />
          <p className="text-sm font-medium text-stone-600">未找到匹配条件的题目</p>
          <p className="text-xs text-stone-400 mt-1">请尝试修改搜索词、章节或标签过滤条件</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q) => {
            const typeBadge = getTypeLabel(q.type);
            const qStatus = getQuestionStatus(q.id);
            const wrongRecord = wrongBook[q.id];
            const hasOpts = q.options && Object.keys(q.options).length > 0;
            const ansLetters = typeof q.answer === 'string' ? q.answer.toUpperCase().split('') : [];

            return (
              <div
                key={q.id}
                className="bg-white border border-stone-200/90 rounded-2xl p-4 md:p-5 shadow-xs hover:border-stone-300 transition-colors"
              >
                {/* 题号、章节、标签与状态操作 */}
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-mono text-xs font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                      #{q.id}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${typeBadge.bg}`}>
                      {typeBadge.label}
                    </span>
                    {q.chapter && (
                      <span className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-medium">
                        {q.chapter}
                      </span>
                    )}
                    {Array.isArray(q.tags) && q.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* 状态标识 & 操作按钮组 */}
                  <div className="flex items-center space-x-2 text-xs flex-wrap gap-y-1">
                    {qStatus === 'wrong' ? (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-rose-700 bg-rose-50 border border-rose-200/90 px-2.5 py-0.5 rounded-md font-medium text-[11px] flex items-center space-x-1">
                          <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                          <span>累计 {wrongRecord?.count || 1} 次</span>
                        </span>

                        {onRemoveFromWrongBook && (
                          <button
                            onClick={async () => {
                              await onRemoveFromWrongBook(q.id);
                              showFeedback(`已将 #${q.id} 移出错题本`);
                            }}
                            className="bg-stone-50 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border border-stone-200 hover:border-emerald-300 px-2 py-0.5 rounded-md font-medium text-[10px] flex items-center space-x-1 transition-colors"
                            title="移出错题本"
                          >
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>移出错题</span>
                          </button>
                        )}
                      </div>
                    ) : qStatus === 'mastered' ? (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2.5 py-0.5 rounded-md font-medium text-[11px] flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>已掌握</span>
                        </span>

                        {onToggleMastered && (
                          <button
                            onClick={async () => {
                              await onToggleMastered(q.id, false);
                              showFeedback(`已将 #${q.id} 重置为未练习`);
                            }}
                            className="text-stone-400 hover:text-stone-700 hover:bg-stone-100 px-1.5 py-0.5 rounded text-[10px] transition-colors border border-transparent hover:border-stone-200"
                            title="重置"
                          >
                            重置
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-stone-500 bg-stone-100 border border-stone-200/80 px-2.5 py-0.5 rounded-md font-medium text-[11px] flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>未练习</span>
                        </span>

                        {onToggleMastered && (
                          <button
                            onClick={async () => {
                              await onToggleMastered(q.id, true);
                              showFeedback(`已将 #${q.id} 标记为已掌握`);
                            }}
                            className="bg-stone-50 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border border-stone-200 hover:border-emerald-300 px-2 py-0.5 rounded-md font-medium text-[10px] flex items-center space-x-1 transition-colors"
                            title="标记为已掌握"
                          >
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>已掌握</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* 从题库彻底删除单题 */}
                    {onDeleteQuestion && (
                      confirmDeleteQuestionId === q.id ? (
                        <div className="flex items-center space-x-1.5 ml-1 animate-in fade-in zoom-in-95 duration-150 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg shadow-2xs">
                          <span className="text-[11px] text-rose-700 font-medium mr-0.5">确认移除</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onDeleteQuestion(q.id);
                              setConfirmDeleteQuestionId(null);
                              showFeedback(`已将题目 #${q.id} 移除`);
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-md transition-colors shadow-xs flex items-center justify-center"
                            title="确认"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteQuestionId(null);
                            }}
                            className="bg-stone-200/80 hover:bg-stone-300 text-stone-600 hover:text-stone-900 p-1 rounded-md transition-colors flex items-center justify-center"
                            title="取消"
                          >
                            <X className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteQuestionId(q.id);
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors ml-1"
                          title="将此题从题库中删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* 题干文本 */}
                <p className="text-sm md:text-base font-semibold text-stone-900 leading-relaxed mb-3">
                  {q.question}
                </p>

                {/* 客观题选项列表 */}
                {hasOpts && (
                  <div className="space-y-2 mb-3">
                    {Object.entries(q.options!).map(([key, val]) => {
                      const isCorrect = ansLetters.includes(key.toUpperCase());
                      return (
                        <div
                          key={key}
                          className={`flex items-start space-x-3 p-2.5 sm:p-3 rounded-xl border text-xs md:text-sm transition-all ${
                            isCorrect
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium'
                              : 'bg-stone-50/40 border-stone-200/70 text-stone-600'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-stone-200/80 text-stone-700'
                            }`}
                          >
                            {key}
                          </span>
                          <div className="flex-1 pt-0.5 leading-normal">
                            {val}
                          </div>
                          {isCorrect && (
                            <span className="text-emerald-700 text-xs font-semibold px-2 py-0.5 shrink-0 flex items-center space-x-1 self-center">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>正确</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 主观题答案展示（高亮关键词） */}
                {!hasOpts && q.answer && (
                  <div className="mb-2.5 p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl text-xs sm:text-sm">
                    <div className="text-[11px] font-bold text-emerald-800 mb-1">
                      答案
                    </div>
                    {Array.isArray(q.keyPoints) && q.keyPoints.length > 0 ? (
                      <div 
                        className="text-emerald-950 leading-relaxed font-sans select-text whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: (() => {
                            const raw = Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer;
                            let html = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            const sortedPoints = [...q.keyPoints]
                              .map(k => k.trim())
                              .filter(Boolean)
                              .sort((a, b) => b.length - a.length);
                            sortedPoints.forEach(kp => {
                              const safeKey = kp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              html = html.replace(new RegExp(`(${safeKey})`, 'gi'), '<span class="text-emerald-950 bg-emerald-100 font-bold px-1 py-0.5 rounded mx-0.5 border border-emerald-300/80">$1</span>');
                            });
                            return html;
                          })()
                        }}
                      />
                    ) : (
                      <p className="text-emerald-950 leading-relaxed font-sans select-text whitespace-pre-wrap">
                        {Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer}
                      </p>
                    )}
                  </div>
                )}

                {/* 关键词展示 */}
                {Array.isArray(q.keyPoints) && q.keyPoints.length > 0 && (
                  <div className="mb-2.5 p-2.5 bg-stone-50 border border-stone-200/70 rounded-xl text-xs">
                    <div className="text-[11px] font-bold text-stone-500 mb-1.5">
                      关键词
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {q.keyPoints.map((point, idx) => (
                        <span key={idx} className="bg-white text-stone-800 font-medium px-2 py-0.5 rounded-md border border-stone-200">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 解析 (如有) */}
                {q.analysis && (
                  <div className="bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-xs text-stone-700 space-y-1">
                    <div className="font-bold text-stone-700 text-[11px]">
                      解析
                    </div>
                    <p className="leading-relaxed text-stone-600 select-text">
                      {q.analysis}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
